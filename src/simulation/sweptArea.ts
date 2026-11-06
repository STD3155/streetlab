import { featureCollection, union } from '@turf/turf';
import type { PolygonXY, Pose, VehicleSpec } from '../domain/types';
import { asFeature } from '../domain/geometry';
import { getVehicleFootprint } from './vehicle';

export function calculateSweptArea(path: Pose[], spec: VehicleSpec, sampleSpacingM = 0.35): PolygonXY[] | null {
  if (!path.length) return null;
  const samples: PolygonXY[] = [getVehicleFootprint(path[0]!, spec)];
  let distanceSinceSample = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!; const b = path[i]!;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    distanceSinceSample += distance;
    if (distanceSinceSample >= sampleSpacingM || i === path.length - 1) {
      samples.push(getVehicleFootprint(b, spec));
      distanceSinceSample = 0;
    }
  }
  try {
    const result = union(featureCollection(samples.map(asFeature)));
    if (!result) return null;
    const polygons = result.geometry.type === 'Polygon' ? [result.geometry.coordinates] : result.geometry.coordinates;
    return polygons.map((rings) => rings.map((ring) => ring.map(([x, y]) => ({ x, y }))));
  } catch { return null; }
}
