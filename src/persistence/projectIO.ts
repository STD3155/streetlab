import { projectDiameterM, toWgs84 } from '../domain/projection';
import type { Project } from '../domain/types';
import { isValidPolygon } from '../domain/geometry';

export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('Die Projektdatei enthält kein gültiges Objekt.');
  const project = value as Partial<Project>;
  if (project.schemaVersion !== 1) throw new Error(`Nicht unterstützte Projektversion: ${String(project.schemaVersion)}.`);
  if (typeof project.id !== 'string' || typeof project.title !== 'string' || !project.centerWgs84 || !Array.isArray(project.baseFeatures) || !Array.isArray(project.scenarios)) {
    throw new Error('Die Projektdatei ist unvollständig oder beschädigt.');
  }
  if (!project.scenarios.length || project.scenarios.some((scenario) => !scenario || !Array.isArray(scenario.additions) || !Array.isArray(scenario.removedBaseFeatureIds) || !Array.isArray(scenario.modifiedBaseFeatures))) throw new Error('Ungültige oder fehlende Szenariodaten.');
  const { lon, lat } = project.centerWgs84;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error('Ungültige Koordinaten im Projekt.');
  if (!Array.isArray(project.boundsWgs84) || project.boundsWgs84.length !== 4 || project.boundsWgs84.some((n) => !Number.isFinite(n)) || project.boundsWgs84[0] >= project.boundsWgs84[2] || project.boundsWgs84[1] >= project.boundsWgs84[3]) throw new Error('Ungültiger Projektbereich.');
  if (projectDiameterM(project.boundsWgs84 as Project['boundsWgs84'], project.centerWgs84) > 500) throw new Error('Der Projektbereich überschreitet die zulässigen 500 m.');
  const allFeatures = [...project.baseFeatures, ...project.scenarios.flatMap((scenario) => [...scenario.additions, ...scenario.modifiedBaseFeatures])];
  for (const feature of allFeatures) {
    if (!feature.id || !['road', 'sidewalk', 'building', 'hard_obstacle', 'curb'].includes(feature.kind) || !Array.isArray(feature.geometry)) throw new Error('Ungültiges Geometrieelement in der Projektdatei.');
    if (!isValidPolygon(feature.geometry)) throw new Error(`Ungültiges Polygon (${feature.properties?.name ?? feature.id}).`);
    for (const ring of feature.geometry) for (const point of ring) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Nicht endliche Geometriekoordinate.');
      if (Math.hypot(point.x, point.y) > 250) throw new Error('Geometrie liegt außerhalb des maximal 500 m großen Projektbereichs.');
    }
  }
  for (const vehicle of project.vehicleSpecs ?? []) {
    if (![vehicle.lengthM, vehicle.widthM, vehicle.wheelbaseM, vehicle.frontOverhangM, vehicle.rearOverhangM, vehicle.maxSteerRad].every(Number.isFinite) || vehicle.lengthM <= 0 || vehicle.widthM <= 0 || vehicle.wheelbaseM <= 0 || vehicle.frontOverhangM < 0 || vehicle.rearOverhangM < 0 || vehicle.maxSteerRad <= 0 || vehicle.maxSteerRad >= Math.PI / 2 || Math.abs(vehicle.lengthM - vehicle.wheelbaseM - vehicle.frontOverhangM - vehicle.rearOverhangM) > 0.02) throw new Error(`Ungültige Fahrzeugparameter (${vehicle.label}).`);
  }
  for (const maneuver of project.maneuvers ?? []) {
    if (![maneuver.start.x, maneuver.start.y, maneuver.start.headingRad, maneuver.goal.x, maneuver.goal.y, maneuver.goal.headingRad].every(Number.isFinite)) throw new Error('Ungültige Start- oder Zielpose.');
    if (!project.vehicleSpecs?.some((vehicle) => vehicle.id === maneuver.vehicleId)) throw new Error('Das Manöver verweist auf einen unbekannten Fahrzeugtyp.');
  }
  return project as Project;
}

export function exportProject(project: Project): string {
  return JSON.stringify(validateProject(project), null, 2);
}

export function importProject(json: string): Project {
  try { return validateProject(JSON.parse(json) as unknown); }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'Projekt konnte nicht gelesen werden.'); }
}

export function exportGeoJson(project: Project): string {
  const toCoords = (rings: Project['baseFeatures'][number]['geometry']) => rings.map((ring) => ring.map(({ x, y }) => {
    const point = toWgs84({ x, y }, project.centerWgs84);
    return [point.lon, point.lat];
  }));
  const features = [
    ...project.baseFeatures.map((feature) => ({ feature, scenarioId: null })),
    ...project.scenarios.flatMap((scenario) => [
      ...scenario.additions.map((feature) => ({ feature, scenarioId: scenario.id })),
      ...scenario.modifiedBaseFeatures.map((feature) => ({ feature, scenarioId: scenario.id })),
    ]),
  ];
  return JSON.stringify({ type: 'FeatureCollection', features: features.map(({ feature, scenarioId }) => ({
    type: 'Feature', id: feature.id, properties: { kind: feature.kind, scenarioId, ...feature.properties }, geometry: { type: 'Polygon', coordinates: toCoords(feature.geometry) },
  })) }, null, 2);
}
