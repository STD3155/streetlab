import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/demo/demoProject';
import { planPath } from '../../src/simulation/planner';
import type { PlanningRequest, PolygonXY } from '../../src/domain/types';
import { isPoseValid } from '../../src/simulation/collision';
import { calculateMetrics } from '../../src/simulation/metrics';

function demoRequest(variant: boolean): PlanningRequest {
  const project = createDemoProject();
  const maneuver = project.maneuvers[0]!;
  const features = [...project.baseFeatures, ...(variant ? project.scenarios[0]!.additions : [])];
  return {
    start: maneuver.start, goal: maneuver.goal, vehicle: project.vehicleSpecs[0]!,
    road: features.filter((feature) => feature.kind === 'road').map((feature) => feature.geometry),
    sidewalks: features.filter((feature) => feature.kind === 'sidewalk').map((feature) => feature.geometry),
    obstacles: features.filter((feature) => feature.kind === 'hard_obstacle' || feature.kind === 'building').map((feature) => feature.geometry),
    mode: 'road_only', gridM: 0.5, headingBins: 24, maxExpansions: 40000, timeoutMs: 12000,
  };
}

const rectangle = (x1: number, y1: number, x2: number, y2: number): PolygonXY => [[{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 }]];

describe('deterministischer Vorwärts-State-Lattice-Planer', () => {
  it('finds a footprint-checked route through the synthetic L curve', () => {
    const result = planPath(demoRequest(false));
    expect(result.status, result.reason).toBe('success');
    expect(result.path.length).toBeGreaterThan(10);
    expect(result.path.every((pose) => isPoseValid(pose, demoRequest(false).vehicle, { road: demoRequest(false).road, sidewalks: [], obstacles: demoRequest(false).obstacles }, 'road_only'))).toBe(true);
  }, 20000);

  it('replans around a scenario island with a distinct newly computed path', () => {
    const base = planPath(demoRequest(false));
    const variant = planPath(demoRequest(true));
    expect(base.status, base.reason).toBe('success');
    expect(variant.status, variant.reason).toBe('success');
    expect(variant.path).not.toEqual(base.path);
    const request = demoRequest(true);
    expect(variant.path.every((pose) => isPoseValid(pose, request.vehicle, { road: request.road, sidewalks: request.sidewalks, obstacles: request.obstacles }, 'road_only'))).toBe(true);
  }, 30000);

  it('does not report success for a completely blocked corridor', () => {
    const request = demoRequest(false);
    request.road = [rectangle(0, 0, 30, 12)];
    request.start = { x: 4, y: 6, headingRad: 0 };
    request.goal = { x: 25, y: 6, headingRad: 0 };
    request.obstacles = [rectangle(14.5, -1, 15.5, 13)];
    const result = planPath(request);
    expect(result.status).not.toBe('success');
    expect(['no_path_found', 'timeout']).toContain(result.status);
  }, 20000);

  it('rejects a sidewalk start in road-only mode but accepts the hypothetical diagnostic mode', () => {
    const request = demoRequest(false);
    request.road = [rectangle(0, -3, 10, 3)];
    request.sidewalks = [rectangle(-4, -3, 0, 3)];
    request.obstacles = [];
    request.start = { x: -1, y: 0, headingRad: 0 };
    request.goal = { x: 5.5, y: 0, headingRad: 0 };
    expect(planPath(request).status).toBe('invalid_input');
    request.mode = 'diagnostic_sidewalk_allowed';
    const diagnostic = planPath(request);
    expect(diagnostic.status).toBe('success');
    const metrics = calculateMetrics(diagnostic.path, request.vehicle, request.obstacles, request.sidewalks);
    expect(metrics.sidewalkTouched).toBe(true);
    expect(metrics.sidewalkOverlapAreaM2).toBeGreaterThan(0);
  }, 20000);

  it('rejects a target pose outside the permitted road area', () => {
    const request = demoRequest(false);
    request.goal = { x: 36, y: 26, headingRad: Math.PI / 2 };
    const result = planPath(request);
    expect(result.status).toBe('invalid_input');
    expect(result.reason).toMatch(/Zielpose/);
  });

  it('accepts a continuous route across adjoining road polygons', () => {
    const request = demoRequest(false);
    request.road = [rectangle(0, -3, 7, 3), rectangle(7, -3, 14, 3)];
    request.sidewalks = [];
    request.obstacles = [];
    request.start = { x: 2, y: 0, headingRad: 0 };
    request.goal = { x: 9.5, y: 0, headingRad: 0 };
    const result = planPath(request);
    expect(result.status, result.reason).toBe('success');
  });
});
