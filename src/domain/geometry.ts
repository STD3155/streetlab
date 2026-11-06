import { polygon } from '@turf/helpers';
import { kinks } from '@turf/kinks';
import type { Feature, Polygon } from 'geojson';
import type { LocalPoint, PolygonXY } from './types';

export function asFeature(rings: PolygonXY): Feature<Polygon> {
  return polygon(rings.map((ring) => ring.map(({ x, y }) => [x, y])));
}

export function isValidPolygon(rings: PolygonXY): boolean {
  if (!rings.length || rings[0].length < 4) return false;
  if (rings.some((ring) => ring.length < 4 || ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) return false;
  const outer = rings[0];
  if (Math.hypot(outer[0].x - outer.at(-1)!.x, outer[0].y - outer.at(-1)!.y) > 1e-6) return false;
  try { return planarArea(rings) > 0.01 && kinks(asFeature(rings)).features.length === 0; }
  catch { return false; }
}

export function polygonArea(rings: PolygonXY): number {
  return planarArea(rings);
}

function ringArea(ring: LocalPoint[]): number {
  let twiceArea = 0;
  for (let i = 1; i < ring.length; i += 1) twiceArea += ring[i - 1]!.x * ring[i]!.y - ring[i]!.x * ring[i - 1]!.y;
  return Math.abs(twiceArea) / 2;
}

function planarArea(rings: PolygonXY): number {
  return Math.max(0, rings.reduce((sum, ring, index) => sum + (index === 0 ? 1 : -1) * ringArea(ring), 0));
}

export function closeRing(points: LocalPoint[]): LocalPoint[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points.at(-1)!;
  return first.x === last.x && first.y === last.y ? points : [...points, { ...first }];
}
