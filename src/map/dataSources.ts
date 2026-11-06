import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { isValidPolygon } from '../domain/geometry';
import { projectDiameterM, toLocal, type Wgs84Point } from '../domain/projection';
import type { FeatureKind, PolygonXY, Project, SurfaceFeature } from '../domain/types';

export const ALKIS_ENDPOINTS = {
  roads: 'https://www.geoportal.rlp.de/spatial-objects/451/collections/ave%3AAX_Strassenverkehr/items',
  buildings: 'https://www.geoportal.rlp.de/spatial-objects/519/collections/ave%3AGebaeudeBauwerk/items',
} as const;
export const IMPORT_LIMIT_PER_COLLECTION = 1000;
const REQUEST_TIMEOUT_MS = 25000;
const MAX_PAGES = 3;

type GeoJsonFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
type FeaturePage = { type?: string; features?: GeoJsonFeature[]; links?: { rel?: string; href?: string }[]; message?: string; remark?: string };
export type SourceImportResult = {
  source: 'alkis';
  features: SurfaceFeature[];
  counts: { streetSpaces: number; buildings: number; skipped: number };
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
    if (Math.hypot(point.x, point.y) > 250) throw new Error('Ein importiertes Objekt liegt außerhalb des lokalen 500-m-Projektbereichs.');
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
      reference: true,
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
  if (center.lon < 5.8 || center.lon > 8.6 || center.lat < 48.7 || center.lat > 51.1) throw new Error('ALKIS-Open-Data ist nur für Rheinland-Pfalz verfügbar. Außerhalb dieser Abdeckung können Flächen manuell erfasst werden.');
  const [roadPage, buildingPage] = await Promise.all([
    fetchFeatureCollection(alkisUrl(ALKIS_ENDPOINTS.roads, bounds), signal),
    fetchFeatureCollection(alkisUrl(ALKIS_ENDPOINTS.buildings, bounds), signal),
  ]);
  const roads = roadPage.features;
  const buildings = buildingPage.features;
  const features = [
    ...roads.flatMap((feature, index) => propertiesFor(feature, 'street_space', 'ALKIS · Straßenverkehrsfläche', center, index)),
    ...buildings.flatMap((feature, index) => propertiesFor(feature, 'building', 'ALKIS · Gebäudeumriss', center, index)),
  ];
  const importedRoads = features.filter((feature) => feature.kind === 'street_space').length;
  const importedBuildings = features.filter((feature) => feature.kind === 'building').length;
  return {
    source: 'alkis', features,
    counts: { streetSpaces: importedRoads, buildings: importedBuildings, skipped: roads.length + buildings.length - importedRoads - importedBuildings },
    notes: [
      'ALKIS Rheinland-Pfalz; monatlicher Aktualisierungsstand laut Dienstmetadaten.',
      'Straßenverkehrsflächen sind katastermäßige Nutzungsflächen, nicht zwingend der asphaltierte Fahrbahnrand oder eine sichere befahrbare Hülle.',
      'ALKIS-Geometrien können aus unterschiedlichen Vermessungsepochen stammen; keine Projektabsteckung oder amtliche Verkehrsplanung.',
      'ALKIS-Weg-Flächen werden nicht als Gehweg ausgegeben: die Objektklasse „Weg“ beweist keinen Gehweg.',
      ...(roadPage.truncated || buildingPage.truncated ? [`Der Import ist auf ${IMPORT_LIMIT_PER_COLLECTION} Objekte je ALKIS-Layer begrenzt; bitte Ausschnitt verkleinern, falls mehr Objekte benötigt werden.`] : []),
    ],
  };
}
