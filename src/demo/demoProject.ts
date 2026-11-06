import { toWgs84 } from '../domain/projection';
import type { PolygonXY, Project, SurfaceFeature, VehicleSpec } from '../domain/types';

const centerWgs84 = { lon: 9, lat: 50 };
const ring = (points: [number, number][]): PolygonXY => [[...points.map(([x, y]) => ({ x, y })), { x: points[0]![0], y: points[0]![1] }]];
const feature = (id: string, kind: SurfaceFeature['kind'], coordinates: [number, number][], name: string): SurfaceFeature => ({
  id, kind, geometry: ring(coordinates), properties: { name, source: 'Synthetische Demo-Geometrie' },
});

export const demoVehicle: VehicleSpec = {
  id: 'demo-car', label: 'Pkw (Modellannahme)', lengthM: 4.50, widthM: 1.80, wheelbaseM: 2.70,
  frontOverhangM: 0.90, rearOverhangM: 0.90, maxSteerRad: 0.55,
};

const road = feature('road-main', 'road', [[0, 0], [30, 0], [30, 32], [18, 32], [18, 12], [0, 12]], 'Fahrbahn · synthetische L-Kurve');
const baseFeatures: SurfaceFeature[] = [
  road,
  feature('sidewalk-south', 'sidewalk', [[0, -2.5], [30, -2.5], [30, 0], [0, 0]], 'Gehweg Süd'),
  feature('sidewalk-north', 'sidewalk', [[0, 12], [18, 12], [18, 14.5], [0, 14.5]], 'Gehweg Nord'),
  feature('sidewalk-west', 'sidewalk', [[15.5, 14.5], [18, 14.5], [18, 32], [15.5, 32]], 'Gehweg West'),
  feature('building-west', 'building', [[-5, -4], [-1, -4], [-1, 18], [-5, 18]], 'Gebäude West'),
  feature('building-north', 'building', [[12, 17], [15.5, 17], [15.5, 23], [12, 23]], 'Gebäude Nord'),
  feature('obstacle-demo', 'hard_obstacle', [[27, 24], [28.5, 24], [28.5, 26], [27, 26]], 'Festes Hindernis'),
];

const boundsWgs84: [number, number, number, number] = (() => {
  const a = toWgs84({ x: -8, y: -8 }, centerWgs84);
  const b = toWgs84({ x: 34, y: 38 }, centerWgs84);
  return [a.lon, a.lat, b.lon, b.lat];
})();

export function createDemoProject(): Project {
  return {
    schemaVersion: 1, id: 'streetlab-demo-l-curve', title: 'Demo-L-Kurve', centerWgs84, boundsWgs84,
    geometrySource: 'Vollständig synthetisch; keine Ortsvermessung.',
    geometryAccuracyNote: 'Didaktische Beispielmaße in lokalen Metern; nicht als reale Planung oder Vermessung geeignet.',
    baseFeatures: structuredClone(baseFeatures), vehicleSpecs: [structuredClone(demoVehicle)],
    maneuvers: [{
      id: 'demo-turn', name: 'Linkskurve', start: { x: 4, y: 6, headingRad: 0 },
      goal: { x: 24, y: 27, headingRad: Math.PI / 2 }, vehicleId: demoVehicle.id, driveMode: 'road_only',
    }],
    scenarios: [{
      id: 'variant-a', name: 'Variante A', additions: [
        feature('island-demo', 'hard_obstacle', [[16.0, 8.0], [19.0, 8.0], [19.0, 10.2], [16.0, 10.2]], 'Verkehrsinsel (Demo)'),
      ], removedBaseFeatureIds: [], modifiedBaseFeatures: [],
    }],
  };
}
