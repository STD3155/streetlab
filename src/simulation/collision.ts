import { booleanPointInPolygon, booleanWithin } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { PolygonXY, Pose, VehicleSpec } from '../domain/types';
import { asFeature, intersects } from '../domain/geometry';
import { getVehicleFootprint } from './vehicle';

export type CollisionWorld = { road: PolygonXY[]; sidewalks: PolygonXY[]; obstacles: PolygonXY[]; roadArea?: Feature<Polygon | MultiPolygon>; diagnosticArea?: Feature<Polygon | MultiPolygon> };

function pointInAny(point: { x: number; y: number }, polygons: PolygonXY[]): boolean {
  return polygons.some((poly) => {
    try { return booleanPointInPolygon([point.x, point.y], asFeature(poly), { ignoreBoundary: false }); }
    catch { return false; }
  });
}

export function isPoseValid(pose: Pose, spec: VehicleSpec, world: CollisionWorld, mode: 'road_only' | 'diagnostic_sidewalk_allowed'): boolean {
  const footprint = getVehicleFootprint(pose, spec);
  if (world.obstacles.some((obstacle) => intersects(footprint, obstacle))) return false;
  if (mode === 'road_only' && world.roadArea) {
    try { return booleanWithin(asFeature(footprint), world.roadArea); }
    catch { return false; }
  }
  if (mode === 'road_only') return world.road.some((road) => {
    try { return booleanWithin(asFeature(footprint), asFeature(road)); }
    catch { return false; }
  });
  if (world.diagnosticArea) {
    try { return booleanWithin(asFeature(footprint), world.diagnosticArea); }
    catch { return false; }
  }
  const points = footprint[0]!;
  return points.every((point) => pointInAny(point, [...world.road, ...world.sidewalks]));
}

function pointSegmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function ringDistance(a: PolygonXY, b: PolygonXY): number {
  let min = Infinity;
  for (const ringA of a) for (let i = 1; i < ringA.length; i += 1) {
    for (const ringB of b) for (let j = 1; j < ringB.length; j += 1) {
      min = Math.min(min, pointSegmentDistance(ringA[i - 1]!, ringB[j - 1]!, ringA[i]!));
      min = Math.min(min, pointSegmentDistance(ringB[j - 1]!, ringA[i - 1]!, ringB[j]!));
    }
  }
  return min;
}

export function footprintClearance(footprint: PolygonXY, obstacles: PolygonXY[]): number {
  if (!obstacles.length) return Infinity;
  let closest = Infinity;
  for (const obstacle of obstacles) {
    if (intersects(footprint, obstacle)) return 0;
    closest = Math.min(closest, ringDistance(footprint, obstacle));
  }
  return closest;
}
