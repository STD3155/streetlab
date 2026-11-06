import proj4 from 'proj4';
import type { LocalPoint } from './types';

export type Wgs84Point = { lon: number; lat: number };

function projection(center: Wgs84Point): string {
  return `+proj=aeqd +lat_0=${center.lat} +lon_0=${center.lon} +datum=WGS84 +units=m +no_defs`;
}

export function toLocal(point: Wgs84Point, center: Wgs84Point): LocalPoint {
  const [x, y] = proj4('EPSG:4326', projection(center), [point.lon, point.lat]);
  return { x, y };
}

export function toWgs84(point: LocalPoint, center: Wgs84Point): Wgs84Point {
  const [lon, lat] = proj4(projection(center), 'EPSG:4326', [point.x, point.y]);
  return { lon, lat };
}

export function projectDiameterM(bounds: [number, number, number, number], center: Wgs84Point): number {
  const [west, south, east, north] = bounds;
  const corners = [
    toLocal({ lon: west, lat: south }, center), toLocal({ lon: east, lat: south }, center),
    toLocal({ lon: east, lat: north }, center), toLocal({ lon: west, lat: north }, center),
  ];
  let max = 0;
  for (const a of corners) for (const b of corners) max = Math.max(max, Math.hypot(a.x - b.x, a.y - b.y));
  return max;
}
