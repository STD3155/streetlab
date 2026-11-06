import { lineString } from '@turf/helpers';
import { lineOffset } from '@turf/line-offset';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { isValidPolygon } from '../domain/geometry';
import { projectDiameterM, toLocal, type Wgs84Point } from '../domain/projection';
import type { FeatureKind, PolygonXY, Project, SurfaceFeature } from '../domain/types';

export const ALKIS_ENDPOINTS = {
  roads: 'https://www.geoportal.rlp.de/spatial-objects/451/collections/ave%3AAX_Strassenverkehr/items',
  buildings: 'https://www.geoportal.rlp.de/spatial-objects/519/collections/ave%3AGebaeudeBauwerk/items',
} as const;
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;
export const IMPORT_LIMIT_PER_COLLECTION = 1000;
const REQUEST_TIMEOUT_MS = 25000;
const MAX_PAGES = 3;

type GeoJsonFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
type FeaturePage = { type?: string; features?: GeoJsonFeature[]; links?: { rel?: string; href?: string }[]; message?: string; remark?: string };
type OsmElement = { type: 'way'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
type OsmResponse = { elements?: OsmElement[]; remark?: string };
export type ImportSource = 'alkis' | 'osm';
export type SourceImportResult = {
  source: ImportSource;
  features: SurfaceFeature[];
  counts: { roads: number; buildings: number; sidewalks: number; skipped: number };
  notes: string[];
};

function checkBounds(bounds: Project['boundsWgs84'], center: Wgs84Point): void {
  const [west, south, east, north] = bounds;
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) throw new Error('Ungültiger geografischer Ausschnitt.');
  if (projectDiameterM(bounds, center) > 500) throw new Error('Der Datenabruf ist auf höchstens 500 m Projektdurchmesser begrenzt. Bitte einen kleineren Ausschnitt wählen.');
}

function abortError(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Datenabruf abgebrochen.', 'AbortError');
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(url, { signal: combined, headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as unknown;
}

function localRing(coords: number[][], center: Wgs84Point): PolygonXY[0] | null {
  if (coords.length < 4) return null;
  const ring = coords.map(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon!) > 180 || Math.abs(lat!) > 90) throw new Error('Die Quelle lieferte ungültige WGS84-Koordinaten.');
    const point = toLocal({ lon: lon!, lat: lat! }, center);
    if (Math.hypot(point.x, point.y) > 300) throw new Error('Ein importiertes Objekt liegt außerhalb des lokalen 500-m-Projektbereichs.');
    return point;
  });
  const first = ring[0]!; const last = ring.at(-1)!;
  if (Math.hypot(first.x - last.x, first.y - last.y) > 0.01) ring.push({ ...first });
  return ring.length >= 4 ? ring : null;
}

function localPolygons(geometry: Polygon | MultiPolygon, center: Wgs84Point): PolygonXY[] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const result: PolygonXY[] = [];
  for (const polygon of polygons) {
    const rings = polygon.map((ring) => localRing(ring, center)).filter((ring): ring is PolygonXY[0] => ring !== null);
    if (rings.length && isValidPolygon(rings)) result.push(rings);
  }
  return result;
}

function propertiesFor(feature: GeoJsonFeature, kind: FeatureKind, sourceName: string, center: Wgs84Point, index: number): SurfaceFeature[] {
  const geometries = localPolygons(feature.geometry, center);
  const props = feature.properties ?? {};
  const externalId = String(props.gml_id ?? props.oid ?? props.id ?? feature.id ?? `feature-${index}`);
  const label = String(props.name ?? props.funktion_beschreibung ?? props.funktion ?? externalId);
  return geometries.map((geometry, part) => ({
    id: `${sourceName}-${kind}-${externalId}-${part}`.replaceAll(/[^a-zA-Z0-9_-]/g, '-'),
    kind,
    geometry,
    properties: {
      name: `${sourceName}: ${label}`,
      source: `${sourceName}; ${externalId}`,
      uncertaintyM: sourceName === 'ALKIS' ? undefined : 1.5,
      sourceObjectId: externalId,
      sourceAttributes: Object.fromEntries(Object.entries(props).filter(([, value]) => typeof value === 'string' || typeof value === 'number')) as Record<string, string | number>,
    },
  }));
}

async function fetchFeatureCollection(url: URL, signal?: AbortSignal): Promise<{ features: GeoJsonFeature[]; truncated: boolean }> {
  const features: GeoJsonFeature[] = [];
  let nextUrl: string | null = url.toString();
  let pages = 0;
  while (nextUrl && pages < MAX_PAGES && features.length < IMPORT_LIMIT_PER_COLLECTION) {
    abortError(signal);
    const body = await getJson(nextUrl, signal) as FeaturePage;
    if (body.message) throw new Error(body.message);
    if (!Array.isArray(body.features)) throw new Error('Der Geodatendienst lieferte keine GeoJSON-Features.');
    features.push(...body.features.slice(0, IMPORT_LIMIT_PER_COLLECTION - features.length));
    const next = body.links?.find((link) => link.rel === 'next')?.href;
        if (next) {
          const candidate: URL = new URL(next, nextUrl);
          if (candidate.origin !== url.origin) throw new Error('Der Geodatendienst lieferte einen nicht vertrauenswürdigen Seitenlink.');
          nextUrl = candidate.toString();
        } else nextUrl = null;
    pages += 1;
  }
  return { features, truncated: Boolean(nextUrl) };
}

function alkisUrl(endpoint: string, bounds: Project['boundsWgs84']): URL {
  const url = new URL(endpoint);
  url.searchParams.set('f', 'json');
  url.searchParams.set('limit', String(IMPORT_LIMIT_PER_COLLECTION));
  url.searchParams.set('bbox', bounds.join(','));
  return url;
}

export async function fetchAlkis(bounds: Project['boundsWgs84'], center: Wgs84Point, signal?: AbortSignal): Promise<SourceImportResult> {
  checkBounds(bounds, center);
  if (center.lon < 5.8 || center.lon > 8.6 || center.lat < 48.7 || center.lat > 51.1) throw new Error('ALKIS-Open-Data ist nur für Rheinland-Pfalz verfügbar. Für andere Regionen bitte OpenStreetMap wählen.');
  const [roadPage, buildingPage] = await Promise.all([
    fetchFeatureCollection(alkisUrl(ALKIS_ENDPOINTS.roads, bounds), signal),
    fetchFeatureCollection(alkisUrl(ALKIS_ENDPOINTS.buildings, bounds), signal),
  ]);
  const roads = roadPage.features;
  const buildings = buildingPage.features;
  const features = [
    ...roads.flatMap((feature, index) => propertiesFor(feature, 'road', 'ALKIS · Straßenverkehrsfläche', center, index)),
    ...buildings.flatMap((feature, index) => propertiesFor(feature, 'building', 'ALKIS · Gebäudeumriss', center, index)),
  ];
  const importedRoads = features.filter((feature) => feature.kind === 'road').length;
  const importedBuildings = features.filter((feature) => feature.kind === 'building').length;
  return {
    source: 'alkis', features,
    counts: { roads: importedRoads, buildings: importedBuildings, sidewalks: 0, skipped: roads.length + buildings.length - importedRoads - importedBuildings },
    notes: [
      'ALKIS Rheinland-Pfalz; monatlicher Aktualisierungsstand laut Dienstmetadaten.',
      'Straßenverkehrsflächen sind katastermäßige Nutzungsflächen, nicht zwingend der asphaltierte Fahrbahnrand oder eine sichere befahrbare Hülle.',
      'ALKIS-Geometrien können aus unterschiedlichen Vermessungsepochen stammen; keine Projektabsteckung oder amtliche Verkehrsplanung.',
      'ALKIS-Weg-Flächen werden nicht als Gehweg ausgegeben: die Objektklasse „Weg“ beweist keinen Gehweg.',
      ...(roadPage.truncated || buildingPage.truncated ? [`Der Import ist auf ${MAX_PAGES * IMPORT_LIMIT_PER_COLLECTION} Objekte je ALKIS-Layer begrenzt; bitte Ausschnitt verkleinern, falls mehr Objekte benötigt werden.`] : []),
    ],
  };
}

function parseWidth(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:m|meter|metre)?\s*$/i);
  if (!match) return undefined;
  const width = Number(match[1]!.replace(',', '.'));
  return Number.isFinite(width) && width >= 1.5 && width <= 30 ? width : undefined;
}

function roadWidth(tags: Record<string, string>): { width: number; note: string } {
  const tagged = parseWidth(tags.width);
  if (tagged) return { width: tagged, note: 'Breite laut OSM width-Tag' };
  const lanes = Number.parseInt(tags.lanes ?? '', 10);
  if (Number.isFinite(lanes) && lanes >= 1 && lanes <= 8) return { width: lanes * 3, note: `aus OSM lanes=${lanes} × 3 m geschätzt` };
  const classes: Record<string, number> = { motorway: 7.5, trunk: 7, primary: 6.5, secondary: 6, tertiary: 5.5, unclassified: 5, residential: 5, living_street: 4.5, service: 4, road: 5, track: 3.5 };
  return { width: classes[tags.highway ?? ''] ?? 5, note: 'Straßenbreite aus highway-Klasse geschätzt; nicht vermessen' };
}

async function lineBuffer(coordsWgs: [number, number][], widthM: number, center: Wgs84Point): Promise<PolygonXY[]> {
  if (coordsWgs.length < 2) return [];
  const { buffer } = await import('@turf/buffer');
  const geometry = buffer(lineString(coordsWgs), widthM / 2, { units: 'meters', steps: 4 })?.geometry;
  if (!geometry) return [];
  return localPolygons(geometry, center);
}

const OSM_ROAD_CLASSES = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'road', 'track']);

async function osmLineFeatures(element: OsmElement, center: Wgs84Point): Promise<SurfaceFeature[]> {
  const tags = element.tags ?? {};
  const coordinates = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
  if (coordinates.length < 2) return [];
  const centerLine = lineString(coordinates);
  const { width, note: widthNote } = roadWidth(tags);
  const areaGeometry = tags.area === 'yes' && coordinates.length >= 4;
  const note = areaGeometry ? 'OSM-Flächengeometrie (area=yes)' : widthNote;
  const roadGeometry = areaGeometry
    ? localPolygons({ type: 'Polygon', coordinates: [coordinates] }, center)
    : tags.highway && OSM_ROAD_CLASSES.has(tags.highway) ? await lineBuffer(coordinates, width, center) : [];
  const features: SurfaceFeature[] = roadGeometry.map((geometry, part) => ({
    id: `osm-road-${element.id}-${part}`,
    kind: 'road',
    geometry,
    properties: { name: tags.name ?? `OSM-Straße #${element.id}`, source: `OpenStreetMap way/${element.id}; ${note}`, sourceObjectId: String(element.id), sourceAttributes: tags, widthSource: note, uncertaintyM: areaGeometry ? undefined : parseWidth(tags.width) ? 0.5 : width / 2 },
  }));
  if (tags.sidewalk === 'both' || tags.sidewalk === 'yes' || tags.sidewalk === 'left' || tags.sidewalk === 'right') {
    const sidewalkWidth = parseWidth(tags['sidewalk:width']) ?? 1.5;
    const sides = tags.sidewalk === 'both' || tags.sidewalk === 'yes' ? [-1, 1] : [tags.sidewalk === 'left' ? 1 : -1];
    for (const [index, side] of sides.entries()) {
      try {
        const offset = lineOffset(centerLine, side * (width / 2 + sidewalkWidth / 2), { units: 'meters' });
        if (offset.geometry.type !== 'LineString') continue;
        const sideCoords = offset.geometry.coordinates as [number, number][];
        const geometry = await lineBuffer(sideCoords, sidewalkWidth, center);
        geometry.forEach((shape, part) => features.push({
          id: `osm-sidewalk-${element.id}-${index}-${part}`, kind: 'sidewalk', geometry: shape,
          properties: { name: `${tags.name ?? `OSM-Gehweg #${element.id}`} · ${side === 1 ? 'links' : 'rechts'}`, source: `OpenStreetMap way/${element.id}; sidewalk-Tag, Breite ${tags['sidewalk:width'] ?? '1,5 m geschätzt'}`, sourceObjectId: String(element.id), sourceAttributes: tags, widthSource: tags['sidewalk:width'] ? 'OSM-Tag sidewalk:width' : '1,5-m-Annahme' },
        }));
      } catch { /* malformed geometry: keep road and omit unverified sidewalk */ }
    }
  }
  if (tags.highway === 'footway' && tags.footway === 'sidewalk') {
    const geometry = await lineBuffer(coordinates, parseWidth(tags.width) ?? 1.5, center);
    geometry.forEach((shape, part) => features.push({ id: `osm-sidewalk-${element.id}-${part}`, kind: 'sidewalk', geometry: shape, properties: { name: tags.name ?? `OSM-Gehweg #${element.id}`, source: `OpenStreetMap way/${element.id}; expliziter Gehweg-Tag`, sourceObjectId: String(element.id), sourceAttributes: tags, widthSource: tags.width ? 'OSM-Tag width' : '1,5-m-Annahme' } }));
  }
  return features;
}

function osmBuilding(element: OsmElement, center: Wgs84Point): SurfaceFeature[] {
  const coords = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
  if (coords.length < 4 || coords[0]![0] !== coords.at(-1)![0] || coords[0]![1] !== coords.at(-1)![1]) return [];
  return localPolygons({ type: 'Polygon', coordinates: [coords] }, center).map((geometry, part) => ({
    id: `osm-building-${element.id}-${part}`, kind: 'building' as const, geometry,
    properties: { name: element.tags?.name ?? `OSM-Gebäude #${element.id}`, source: `OpenStreetMap way/${element.id}`, sourceObjectId: String(element.id), sourceAttributes: element.tags ?? {} },
  }));
}

export function buildOverpassQuery(bounds: Project['boundsWgs84']): string {
  const [west, south, east, north] = bounds;
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:20];(way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road|track)$"](${box});way["highway"="footway"]["footway"="sidewalk"](${box});way["building"](${box}););out body geom;`;
}

export async function convertOsmElements(elements: OsmElement[], center: Wgs84Point): Promise<SourceImportResult> {
  const features: SurfaceFeature[] = [];
  let skipped = 0;
  for (const element of elements) {
    const tags = element.tags ?? {};
    const localPoints = (element.geometry ?? []).map(({ lon, lat }) => toLocal({ lon, lat }, center));
    if (localPoints.length < 2 || localPoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.hypot(point.x, point.y) > 260)) { skipped += 1; continue; }
    if (tags.building) {
      const built = osmBuilding(element, center);
      if (built.length) features.push(...built); else skipped += 1;
      continue;
    }
    if (OSM_ROAD_CLASSES.has(tags.highway ?? '') || tags.highway === 'footway' && tags.footway === 'sidewalk') {
      const made = await osmLineFeatures(element, center);
      if (made.length) features.push(...made); else skipped += 1;
      continue;
    }
    skipped += 1;
  }
  return { source: 'osm', features, counts: { roads: features.filter((feature) => feature.kind === 'road').length, buildings: features.filter((feature) => feature.kind === 'building').length, sidewalks: features.filter((feature) => feature.kind === 'sidewalk').length, skipped }, notes: [
    'OpenStreetMap-Daten © OpenStreetMap-Mitwirkende, ODbL 1.0; Datenstand des Abrufs.',
    'OSM-Straßen sind häufig Mittellinien. Für die Visualisierung wird daraus eine Fläche mit dokumentierter Breitenannahme gepuffert; das ist keine vermessene Fahrbahnbegrenzung.',
    'Gehwege werden nur importiert, wenn sie in OSM ausdrücklich als solche getaggt sind.',
    'OSM-Gebäudemultipolygone aus Relationen werden in diesem PoC nicht importiert; erfasst werden geschlossene Wege.',
  ] };
}

export async function fetchOsm(bounds: Project['boundsWgs84'], center: Wgs84Point, signal?: AbortSignal): Promise<SourceImportResult> {
  checkBounds(bounds, center);
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    abortError(signal);
    try {
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const response = await fetch(endpoint, { method: 'POST', signal: requestSignal, headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ data: buildOverpassQuery(bounds) }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as OsmResponse;
      if (result.remark) throw new Error(result.remark);
      if (!Array.isArray(result.elements)) throw new Error('Keine OSM-Elemente in der Antwort.');
      return await convertOsmElements(result.elements, center);
    } catch (error) {
      abortError(signal);
      errors.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : 'Netzwerkfehler'}`);
    }
  }
  throw new Error(`Overpass nicht erreichbar: ${errors.join(' · ')}`);
}

export async function fetchSource(source: ImportSource, bounds: Project['boundsWgs84'], center: Wgs84Point, signal?: AbortSignal): Promise<SourceImportResult> {
  return source === 'alkis' ? fetchAlkis(bounds, center, signal) : fetchOsm(bounds, center, signal);
}
