import { featureCollection, intersect } from '@turf/turf';
import type { PolygonXY, Pose, VehicleSpec } from '../domain/types';
import { asFeature, intersects, polygonArea } from '../domain/geometry';
import { footprintClearance } from './collision';
import { getVehicleFootprint, pathLength } from './vehicle';

export type Metrics = { lengthM: number; minObstacleClearanceM: number; sidewalkOverlapAreaM2: number; sidewalkTouched: boolean; hardCollision: boolean };

export function calculateMetrics(path: Pose[], vehicle: VehicleSpec, obstacles: PolygonXY[], sidewalks: PolygonXY[]): Metrics {
  let minObstacleClearanceM = Infinity;
  let sidewalkOverlapAreaM2 = 0;
  let sidewalkTouched = false;
  let hardCollision = false;
  for (const pose of path) {
    const footprint = getVehicleFootprint(pose, vehicle);
    minObstacleClearanceM = Math.min(minObstacleClearanceM, footprintClearance(footprint, obstacles));
    hardCollision ||= obstacles.some((obstacle) => intersects(footprint, obstacle));
    for (const sidewalk of sidewalks) {
      if (!intersects(footprint, sidewalk)) continue;
      sidewalkTouched = true;
      try {
        const intersection = turfIntersection(footprint, sidewalk);
        if (intersection?.geometry.type === 'Polygon') {
          const local = intersection.geometry.coordinates.map((ring) => ring.map(([x, y]) => ({ x, y })));
          sidewalkOverlapAreaM2 = Math.max(sidewalkOverlapAreaM2, polygonArea(local));
        }
      } catch { /* report contact even if an overlap polygon cannot be formed */ }
    }
  }
  return { lengthM: pathLength(path), minObstacleClearanceM, sidewalkOverlapAreaM2, sidewalkTouched, hardCollision };
}

function turfIntersection(a: PolygonXY, b: PolygonXY) {
  return intersect(featureCollection([asFeature(a), asFeature(b)]));
}
