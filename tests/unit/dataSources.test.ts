import { afterEach, describe, expect, it, vi } from 'vitest';
import { toWgs84 } from '../../src/domain/projection';
import { ALKIS_ENDPOINTS, buildOverpassQuery, convertOsmElements, fetchAlkis, fetchOsm } from '../../src/map/dataSources';
import type { Project } from '../../src/domain/types';

const center = { lon: 8.35, lat: 49.56 };
const bounds: Project['boundsWgs84'] = [8.3485, 49.5585, 8.3515, 49.5615];
const point = (x: number, y: number) => {
  const wgs = toWgs84({ x, y }, center);
  return [wgs.lon, wgs.lat];
};
const rectangle = (x: number, y: number, w: number, h: number) => [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h), point(x, y)];

afterEach(() => vi.unstubAllGlobals());

describe('Datenquellen ALKIS und OpenStreetMap', () => {
  it('builds a bounded Overpass query including road, building and explicit sidewalk ways', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('"highway"');
    expect(query).toContain('"building"');
    expect(query).toContain('49.5585,8.3485,49.5615,8.3515');
    expect(query).toContain('"footway"="sidewalk"');
  });

  it('imports OSM roads, buildings and only explicitly tagged sidewalks in local metres', async () => {
    const start = point(-10, 0); const end = point(10, 0);
    const elements: Parameters<typeof convertOsmElements>[0] = [
      { type: 'way' as const, id: 101, tags: { highway: 'residential', width: '6', sidewalk: 'both', 'sidewalk:width': '1.8', name: 'Teststraße' }, geometry: [{ lon: start[0]!, lat: start[1]! }, { lon: end[0]!, lat: end[1]! }] },
      { type: 'way' as const, id: 102, tags: { building: 'yes', name: 'Testhaus' }, geometry: rectangle(4, 8, 6, 5).map(([lon, lat]) => ({ lon: lon!, lat: lat! })) },
      { type: 'way' as const, id: 103, tags: { highway: 'footway' }, geometry: [{ lon: start[0]!, lat: start[1]! }, { lon: end[0]!, lat: end[1]! }] },
    ];
    const result = await convertOsmElements(elements, center);
    expect(result.counts.roads).toBe(1);
    expect(result.counts.buildings).toBe(1);
    expect(result.counts.sidewalks).toBe(2);
    expect(result.features.some((feature) => feature.kind === 'sidewalk' && feature.properties?.name?.includes('Teststraße'))).toBe(true);
    expect(result.notes.join(' ')).toMatch(/keine vermessene Fahrbahnbegrenzung/i);
    const road = result.features.find((feature) => feature.kind === 'road')!;
    expect(road.properties?.widthSource).toMatch(/OSM width/i);
    expect(road.geometry[0]!.every((vertex) => Math.abs(vertex.x) < 14 && Math.abs(vertex.y) < 4)).toBe(true);
  });

  it('imports official ALKIS road and building polygons through the GeoJSON features service', async () => {
    const roadFeature = { type: 'Feature', id: 'AX_Strassenverkehr.1', properties: { gml_id: 'AX_Strassenverkehr.1' }, geometry: { type: 'Polygon', coordinates: [rectangle(-20, -3, 40, 6)] } };
    const buildingFeature = { type: 'Feature', id: 'GebaeudeBauwerk.2', properties: { gml_id: 'GebaeudeBauwerk.2', funktion: 'Wohnhaus' }, geometry: { type: 'Polygon', coordinates: [rectangle(5, 5, 8, 8)] } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const features = url.origin + url.pathname === ALKIS_ENDPOINTS.roads ? [roadFeature] : [buildingFeature];
      return new Response(JSON.stringify({ type: 'FeatureCollection', features, links: [] }), { status: 200, headers: { 'Content-Type': 'application/geo+json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchAlkis(bounds, center);
    expect(result.source).toBe('alkis');
    expect(result.counts).toEqual({ roads: 1, buildings: 1, sidewalks: 0, skipped: 0 });
    expect(result.features.find((feature) => feature.kind === 'road')?.geometry[0]?.[0]?.x).toBeCloseTo(-20, 1);
    expect(result.features.find((feature) => feature.kind === 'building')?.properties?.sourceObjectId).toBe('GebaeudeBauwerk.2');
    expect(result.notes.join(' ')).toMatch(/monatlich/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(requests.every((url) => url.searchParams.get('bbox') === bounds.join(','))).toBe(true);
  });

  it('rejects ALKIS outside Rheinland-Pfalz and bounds beyond the service cap', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAlkis(bounds, { lon: 9, lat: 50 })).rejects.toThrow(/nur für Rheinland-Pfalz/i);
    await expect(fetchAlkis([8.3, 49.5, 8.4, 49.6], center)).rejects.toThrow(/höchstens 500 m/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects OSM requests outside the 500 m project extent before networking', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(fetchOsm([8.3, 49.5, 8.4, 49.6], center)).rejects.toThrow(/höchstens 500 m/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects broken GeoJSON rather than silently importing it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'Backendfehler' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAlkis(bounds, center)).rejects.toThrow(/Backendfehler/);
  });
});
