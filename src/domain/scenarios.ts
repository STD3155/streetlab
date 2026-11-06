import type { Project, SurfaceFeature } from './types';

export function resolveScenario(project: Project, scenarioId: string): SurfaceFeature[] {
  const scenario = project.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Szenario „${scenarioId}“ wurde nicht gefunden.`);
  const removed = new Set(scenario.removedBaseFeatureIds);
  const modified = new Map(scenario.modifiedBaseFeatures.map((feature) => [feature.id, feature]));
  return [
    ...project.baseFeatures.filter((feature) => !removed.has(feature.id)).map((feature) => modified.get(feature.id) ?? feature),
    ...scenario.additions,
  ];
}
