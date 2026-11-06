import { projectDiameterM, toWgs84 } from '../domain/projection';
import type { Project } from '../domain/types';
import { isValidPolygon } from '../domain/geometry';

export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('Die Projektdatei enthält kein gültiges Objekt.');
  const project = value as Partial<Project>;
  if (project.schemaVersion !== 2) throw new Error(`Nicht unterstützte Projektversion: ${String(project.schemaVersion)}.`);
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
    if (!feature.id || !['street_space', 'road', 'sidewalk', 'building', 'hard_obstacle', 'curb'].includes(feature.kind) || !Array.isArray(feature.geometry)) throw new Error('Ungültiges Geometrieelement in der Projektdatei.');
    if (!isValidPolygon(feature.geometry)) throw new Error(`Ungültiges Polygon (${feature.properties?.name ?? feature.id}).`);
    for (const ring of feature.geometry) for (const point of ring) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Nicht endliche Geometriekoordinate.');
      if (Math.hypot(point.x, point.y) > 250) throw new Error('Geometrie liegt außerhalb des maximal 500 m großen Projektbereichs.');
    }
  }
  return project as Project;
}

// Migrate old projects without retaining the retired simulator's fields.
function migrateProject(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) return value;
  const { id, title, centerWgs84, boundsWgs84, geometrySource, geometryAccuracyNote, baseFeatures, scenarios } = record;
  if (!Array.isArray(baseFeatures) || !Array.isArray(scenarios)) throw new Error('Ungültige Projektdaten.');
  const references = new Set<string>();
  const migratedFeatures = baseFeatures.map((feature) => {
    if (feature?.properties?.source?.startsWith('ALKIS')) {
      references.add(feature.id);
      return { ...feature, kind: feature.kind === 'road' ? 'street_space' : feature.kind, properties: { ...feature.properties, reference: true } };
    }
    return feature;
  });
  return {
    schemaVersion: 2, id, title, centerWgs84, boundsWgs84, geometrySource, geometryAccuracyNote,
    baseFeatures: migratedFeatures,
    scenarios: scenarios.map((scenario) => {
      if (!scenario || !Array.isArray(scenario.modifiedBaseFeatures) || !Array.isArray(scenario.removedBaseFeatureIds)) throw new Error('Ungültige Szenariodaten.');
      return { ...scenario,
        modifiedBaseFeatures: scenario.modifiedBaseFeatures.filter((feature: { id: string }) => !references.has(feature.id)),
        removedBaseFeatureIds: scenario.removedBaseFeatureIds.filter((id: string) => !references.has(id)),
      };
    }),
  };
}

export function exportProject(project: Project): string {
  return JSON.stringify(validateProject(project), null, 2);
}

export function importProject(json: string): Project {
  try { return validateProject(migrateProject(JSON.parse(json) as unknown)); }
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
