import { describe, expect, it } from 'vitest';
import { polygonArea } from '../../src/domain/geometry';
import type { PolygonXY, VehicleSpec } from '../../src/domain/types';
import { isPoseValid } from '../../src/simulation/collision';
import { calculateMetrics } from '../../src/simulation/metrics';
import { calculateSweptArea } from '../../src/simulation/sweptArea';
import { getVehicleFootprint, integrateDistance, integrateStep } from '../../src/simulation/vehicle';

const car: VehicleSpec = { id: 'test', label: 'Test-Pkw', lengthM: 4.5, widthM: 1.8, wheelbaseM: 2.7, frontOverhangM: 0.9, rearOverhangM: 0.9, maxSteerRad: 0.55 };
const rect = (x1: number, y1: number, x2: number, y2: number): PolygonXY => [[{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 }]];
const emptyWorld = { road: [rect(-100, -100, 100, 100)], sidewalks: [], obstacles: [] };

describe('Pkw-Kinematik und vollständiger Fahrzeugumriss', () => {
  it('integrates 10 m straight with bounded numerical steps', () => {
    const path = integrateDistance({ x: 2, y: 3, headingRad: 0 }, 0, 10, car);
    expect(path.at(-1)!.x).toBeCloseTo(12, 8);
    expect(path.at(-1)!.y).toBeCloseTo(3, 8);
    expect(path.at(-1)!.headingRad).toBe(0);
    expect(path.length).toBeGreaterThanOrEqual(101);
  });

  it('uses the bicycle curvature and correct left-turn sign', () => {
    const steer = 0.3;
    const step = integrateStep({ x: 0, y: 0, headingRad: 0 }, steer, 1, car);
    expect(step.headingRad).toBeCloseTo(Math.tan(steer) / car.wheelbaseM, 8);
    expect(step.y).toBeGreaterThan(0);
    expect(step.x).toBeGreaterThan(0);
  });

  it('places the footprint relative to rear-axle centre with overhangs', () => {
    const footprint = getVehicleFootprint({ x: 10, y: 5, headingRad: 0 }, car)[0]!;
    expect(Math.min(...footprint.map((p) => p.x))).toBeCloseTo(9.1, 8);
    expect(Math.max(...footprint.map((p) => p.x))).toBeCloseTo(13.6, 8);
    expect(Math.min(...footprint.map((p) => p.y))).toBeCloseTo(4.1, 8);
    expect(Math.max(...footprint.map((p) => p.y))).toBeCloseTo(5.9, 8);
  });

  it('approximates the union of footprints for a straight swept area', () => {
    const path = integrateDistance({ x: 0, y: 0, headingRad: 0 }, 0, 10, car);
    const swept = calculateSweptArea(path, car);
    expect(swept).not.toBeNull();
    expect(swept!.length).toBe(1);
    expect(polygonArea(swept![0]!)).toBeCloseTo(car.widthM * (10 + car.lengthM), 0);
  });

  it('preserves disconnected components of a MultiPolygon swept result', () => {
    const swept = calculateSweptArea([{ x: 0, y: 0, headingRad: 0 }, { x: 20, y: 0, headingRad: 0 }], car);
    expect(swept).toHaveLength(2);
  });

  it('detects an obstacle in the front overhang while the rear axle is clear', () => {
    const pose = { x: 0, y: 0, headingRad: 0 };
    const world = { ...emptyWorld, obstacles: [rect(2.95, -0.3, 3.2, 0.3)] };
    expect(isPoseValid(pose, car, world, 'road_only')).toBe(false);
  });

  it('detects close curve-edge obstacles using the complete turning footprint', () => {
    const curved = integrateDistance({ x: 0, y: 0, headingRad: 0 }, 0.45, 2, car);
    const nearFront = getVehicleFootprint(curved[10]!, car)[0]![1]!;
    const world = { ...emptyWorld, obstacles: [rect(nearFront.x - 0.08, nearFront.y - 0.08, nearFront.x + 0.08, nearFront.y + 0.08)] };
    expect(isPoseValid(curved[10]!, car, world, 'road_only')).toBe(false);
  });

  it('reports positive sidewalk overlap in diagnostic metrics', () => {
    const pose = { x: 0, y: 0, headingRad: 0 };
    const metrics = calculateMetrics([pose], car, [], [rect(2, -2, 4, 2)]);
    expect(metrics.sidewalkTouched).toBe(true);
    expect(metrics.sidewalkOverlapAreaM2).toBeGreaterThan(0);
  });
});
