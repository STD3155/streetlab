import { describe, expect, it } from 'vitest';
import { projectFixture } from '../fixtures/project';
import { isValidPolygon, polygonArea } from '../../src/domain/geometry';
import { projectDiameterM, toLocal, toWgs84 } from '../../src/domain/projection';
import { resolveScenario } from '../../src/domain/scenarios';
import { exportGeoJson, exportProject, importProject } from '../../src/persistence/projectIO';
import type { PolygonXY } from '../../src/domain/types';

const square: PolygonXY = [[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }]];

describe('Projekt, Geometrie und Projektion', () => {
  it('round-trips local metres at widely separated WGS84 centres', () => {
    for (const center of [{ lon: 6.1, lat: 50.7 }, { lon: 13.4, lat: 52.5 }]) {
      const original = { x: 123.45, y: -67.89 };
      const geographic = toWgs84(original, center);
      const roundTrip = toLocal(geographic, center);
      expect(Math.hypot(roundTrip.x - original.x, roundTrip.y - original.y)).toBeLessThan(0.001);
    }
  });

  it('limits project diameter and validates finite closed polygons', () => {
    expect(projectDiameterM([-0.001, -0.001, 0.001, 0.001], { lon: 9, lat: 50 })).toBeGreaterThan(200);
    expect(isValidPolygon(square)).toBe(true);
    expect(polygonArea(square)).toBe(12);
    expect(isValidPolygon([[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: Number.NaN, y: 1 }, { x: 0, y: 0 }]])).toBe(false);
    expect(isValidPolygon([[{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }]])).toBe(false);
  });

  it('preserves scenario isolation and project data through import/export', () => {
    const project = projectFixture();
    const baseBefore = structuredClone(project.baseFeatures);
    const variantFeatures = resolveScenario(project, 'variant-a');
    expect(variantFeatures.length).toBe(project.baseFeatures.length + 1);
    expect(project.baseFeatures).toEqual(baseBefore);
    const roundTrip = importProject(exportProject(project));
    expect(roundTrip.centerWgs84).toEqual(project.centerWgs84);
    expect(roundTrip.baseFeatures).toEqual(project.baseFeatures);
    expect(roundTrip.scenarios).toEqual(project.scenarios);
    expect(JSON.parse(exportGeoJson(project)).type).toBe('FeatureCollection');
  });

  it('rejects unknown schema versions and oversized bounds', () => {
    const project = projectFixture();
    expect(() => importProject(JSON.stringify({ ...project, schemaVersion: 999 }))).toThrow(/version/i);
    expect(() => importProject(JSON.stringify({ ...project, boundsWgs84: [-1, -1, 1, 1] }))).toThrow(/500 m/);
    expect(() => importProject('{broken')).toThrow();
    const invalid = projectFixture();
    invalid.scenarios[0]!.additions[0]!.geometry = [[{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }]];
    expect(() => importProject(JSON.stringify(invalid))).toThrow(/Polygon/);
  });
});

describe('Migration aus dem früheren Simulator', () => {
  it('keeps manual geometry and separates ALKIS references from carriageways', () => {
    const old = { ...projectFixture(), schemaVersion: 1, vehicleSpecs: [{ id: 'old-car' }], maneuvers: [{ id: 'old-maneuver' }] };
    old.baseFeatures.push({ ...structuredClone(old.baseFeatures[0]!), id: 'alkis-road', properties: { source: 'ALKIS · Straßenverkehrsfläche; old-1' } });
    const migrated = importProject(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.baseFeatures.find((feature) => feature.id === 'road-main')?.kind).toBe('road');
    expect(migrated.baseFeatures.find((feature) => feature.id === 'alkis-road')).toMatchObject({ kind: 'street_space', properties: { reference: true } });
    expect(JSON.parse(exportProject(migrated))).not.toHaveProperty('vehicleSpecs');
    expect(JSON.parse(exportProject(migrated))).not.toHaveProperty('maneuvers');
  });
});
