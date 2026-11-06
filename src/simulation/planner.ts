import { featureCollection, union } from '@turf/turf';
import { asFeature } from '../domain/geometry';
import { isPoseValid, type CollisionWorld } from './collision';
import { integrateDistance, interpolatePose } from './vehicle';
import type { PlanningRequest, PlanningResult, PolygonXY, Pose } from '../domain/types';

type Node = { pose: Pose; key: string; g: number; f: number; parent?: Node; segment?: Pose[]; steer: number };
type Progress = (expanded: number) => void;

class MinHeap<T extends { f: number }> {
  private items: T[] = [];
  get size() { return this.items.length; }
  push(item: T) {
    this.items.push(item); let i = this.items.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.items[p]!.f <= item.f) break; this.items[i] = this.items[p]!; i = p; }
    this.items[i] = item;
  }
  pop(): T | undefined {
    if (!this.items.length) return undefined;
    const root = this.items[0]!; const last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (true) { let c = i * 2 + 1; if (c >= this.items.length) break; if (c + 1 < this.items.length && this.items[c + 1]!.f < this.items[c]!.f) c += 1; if (this.items[c]!.f >= last.f) break; this.items[i] = this.items[c]!; i = c; }
      this.items[i] = last;
    }
    return root;
  }
}

const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function mergePolygons(polygons: PolygonXY[]) {
  if (!polygons.length) return null;
  if (polygons.length === 1) return asFeature(polygons[0]!);
  return union(featureCollection(polygons.map(asFeature)));
}

export function planPath(request: PlanningRequest, cancelled: () => boolean = () => false, onProgress: Progress = () => undefined): PlanningResult {
  const started = performance.now();
  const timeoutMs = request.timeoutMs ?? 12000;
  const maxExpansions = request.maxExpansions ?? 45000;
  const grid = request.gridM ?? 0.5;
  const headingBins = request.headingBins ?? 24;
  const binAngle = 2 * Math.PI / headingBins;
  const stepLength = Math.max(1.0, grid * 2.5);
  const world: CollisionWorld = { road: request.road, sidewalks: request.sidewalks, obstacles: request.obstacles };
  if (!request.road.length || !request.start || !request.goal || !(request.vehicle.wheelbaseM > 0)) {
    return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Fahrbahn, Posen oder Fahrzeugparameter fehlen.' };
  }
  try {
    const roadArea = mergePolygons(request.road);
    if (!roadArea) return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Fahrbahnflächen lassen sich nicht zu einer gültigen Geometrie verbinden.' };
    world.roadArea = roadArea;
  } catch {
    return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Fahrbahngeometrie ist ungültig.' };
  }
  if (request.mode === 'diagnostic_sidewalk_allowed') {
    try {
      const area = mergePolygons([...request.road, ...request.sidewalks]);
      if (!area) return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Fahrbahn und Gehwege lassen sich nicht zu einer gültigen befahrbaren Fläche verbinden.' };
      world.diagnosticArea = area;
    } catch {
      return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Geometrie für den diagnostischen Fahrmodus ist ungültig.' };
    }
  }
  if (!isPoseValid(request.start, request.vehicle, world, request.mode)) return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Der vollständige Fahrzeugumriss kollidiert an der Startpose oder liegt außerhalb der zulässigen Fläche.' };
  if (!isPoseValid(request.goal, request.vehicle, world, request.mode)) return { status: 'invalid_input', path: [], expansions: 0, elapsedMs: performance.now() - started, reason: 'Der vollständige Fahrzeugumriss kollidiert an der Zielpose oder liegt außerhalb der zulässigen Fläche.' };

  const keyOf = (pose: Pose) => `${Math.round(pose.x / grid)},${Math.round(pose.y / grid)},${Math.round(((pose.headingRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / binAngle) % headingBins}`;
  const heuristic = (pose: Pose) => Math.hypot(request.goal.x - pose.x, request.goal.y - pose.y) + Math.abs(angleDelta(request.goal.headingRad, pose.headingRad)) * request.vehicle.wheelbaseM * 0.8;
  const open = new MinHeap<Node>();
  const initial: Node = { pose: request.start, key: keyOf(request.start), g: 0, f: heuristic(request.start), steer: 0 };
  open.push(initial);
  const best = new Map<string, number>([[initial.key, 0]]);
  const steerValues = [-request.vehicle.maxSteerRad, -request.vehicle.maxSteerRad * 0.5, 0, request.vehicle.maxSteerRad * 0.5, request.vehicle.maxSteerRad];
  let expanded = 0;
  let goalNode: Node | undefined;

  while (open.size && expanded < maxExpansions) {
    if (cancelled()) return { status: 'timeout', path: [], expansions: expanded, elapsedMs: performance.now() - started, reason: 'Berechnung wurde abgebrochen.' };
    if ((expanded & 127) === 0) {
      onProgress(expanded);
      if (performance.now() - started > timeoutMs) return { status: 'timeout', path: [], expansions: expanded, elapsedMs: performance.now() - started, reason: `Zeitlimit von ${timeoutMs} ms erreicht.` };
    }
    const node = open.pop()!;
    if (node.g > (best.get(node.key) ?? Infinity) + 1e-8) continue;
    expanded += 1;
    const positionError = Math.hypot(request.goal.x - node.pose.x, request.goal.y - node.pose.y);
    if (positionError <= Math.max(0.55, grid * 1.1) && Math.abs(angleDelta(request.goal.headingRad, node.pose.headingRad)) <= Math.max(8 * Math.PI / 180, binAngle * 0.6)) {
      goalNode = node; break;
    }

    for (const steer of steerValues) {
      const segment = integrateDistance(node.pose, steer, stepLength, request.vehicle);
      let valid = true;
      for (let i = 2; i < segment.length; i += 2) {
        if (!isPoseValid(segment[i]!, request.vehicle, world, request.mode)) { valid = false; break; }
      }
      if (valid && (segment.length - 1) % 2 !== 0 && !isPoseValid(segment.at(-1)!, request.vehicle, world, request.mode)) valid = false;
      if (!valid) continue;
      const end = segment.at(-1)!;
      const key = keyOf(end);
      const steeringCost = Math.abs(steer - node.steer) * 0.35;
      const g = node.g + stepLength + steeringCost;
      if (g >= (best.get(key) ?? Infinity) - 1e-8) continue;
      best.set(key, g);
      open.push({ pose: end, key, g, f: g + heuristic(end), parent: node, segment, steer });
    }
  }
  onProgress(expanded);
  if (!goalNode) {
    const elapsedMs = performance.now() - started;
    const timedOut = elapsedMs > timeoutMs || expanded >= maxExpansions;
    return { status: timedOut ? 'timeout' : 'no_path_found', path: [], expansions: expanded, elapsedMs, reason: timedOut ? 'Suchbudget erreicht; kein mathematischer Unmöglichkeitsbeweis.' : 'Innerhalb des endlichen Suchraums wurde keine gültige Route gefunden.' };
  }

  const segments: Pose[][] = [];
  let cursor: Node | undefined = goalNode;
  while (cursor?.parent) { if (cursor.segment) segments.push(cursor.segment); cursor = cursor.parent; }
  segments.reverse();
  const path = segments.flatMap((segment, index) => index ? segment.slice(1) : segment);
  if (!path.length) path.push({ ...request.start });
  // Refine the reported path at 0.1 m and verify continuously sampled footprints independently.
  const refined: Pose[] = [path[0]!];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!; const b = path[i]!;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(distance / 0.1));
    for (let j = 1; j <= steps; j += 1) refined.push(interpolatePose(a, b, j / steps));
  }
  // The interpolation is used only as a conservative independent footprint check; integration samples remain the returned path.
  if (refined.some((pose) => !isPoseValid(pose, request.vehicle, world, request.mode))) {
    return { status: 'no_path_found', path: [], expansions: expanded, elapsedMs: performance.now() - started, reason: 'Feinprüfung hat eine Kollision im Suchpfad erkannt.' };
  }
  return { status: 'success', path, expansions: expanded, elapsedMs: performance.now() - started };
}
