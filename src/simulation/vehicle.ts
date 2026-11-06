import type { PolygonXY, Pose, VehicleSpec } from '../domain/types';

export const MAX_STEP_M = 0.1;
export const MAX_HEADING_STEP_RAD = 2 * Math.PI / 180;

export function integrateStep(pose: Pose, steerRad: number, dsM: number, spec: VehicleSpec): Pose {
  if (!Number.isFinite(dsM) || dsM < 0 || !Number.isFinite(steerRad)) throw new Error('Ungültiger Integrationsschritt.');
  if (Math.abs(steerRad) > spec.maxSteerRad + 1e-9) throw new Error('Lenkwinkel überschreitet das Fahrzeugmodell.');
  const curvature = Math.tan(steerRad) / spec.wheelbaseM;
  const dTheta = curvature * dsM;
  const midHeading = pose.headingRad + dTheta / 2;
  const distance = Math.abs(curvature) < 1e-10 ? dsM : 2 * Math.sin(dTheta / 2) / curvature;
  return { x: pose.x + distance * Math.cos(midHeading), y: pose.y + distance * Math.sin(midHeading), headingRad: pose.headingRad + dTheta };
}

export function integrateDistance(pose: Pose, steerRad: number, distanceM: number, spec: VehicleSpec): Pose[] {
  const curvature = Math.tan(steerRad) / spec.wheelbaseM;
  const step = Math.min(MAX_STEP_M, Math.abs(curvature) < 1e-12 ? MAX_STEP_M : MAX_HEADING_STEP_RAD / Math.abs(curvature));
  const count = Math.max(1, Math.ceil(distanceM / step));
  const poses: Pose[] = [{ ...pose }];
  let current = pose;
  for (let i = 0; i < count; i += 1) {
    current = integrateStep(current, steerRad, distanceM / count, spec);
    poses.push(current);
  }
  return poses;
}

export function getVehicleFootprint(pose: Pose, spec: VehicleSpec): PolygonXY {
  const rear = -spec.rearOverhangM;
  const front = spec.wheelbaseM + spec.frontOverhangM;
  const halfWidth = spec.widthM / 2;
  const c = Math.cos(pose.headingRad);
  const s = Math.sin(pose.headingRad);
  const corners = [[rear, -halfWidth], [front, -halfWidth], [front, halfWidth], [rear, halfWidth], [rear, -halfWidth]];
  return [corners.map(([x, y]) => ({ x: pose.x + x! * c - y! * s, y: pose.y + x! * s + y! * c }))];
}

export function pathLength(path: Pose[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i += 1) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return length;
}

export function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  const delta = Math.atan2(Math.sin(b.headingRad - a.headingRad), Math.cos(b.headingRad - a.headingRad));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, headingRad: a.headingRad + delta * t };
}
