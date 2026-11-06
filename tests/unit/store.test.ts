import { beforeEach, describe, expect, it } from 'vitest';
import { useStreetLab } from '../../src/app/store';
import { createDemoProject } from '../../src/demo/demoProject';
import { resolveScenario } from '../../src/domain/scenarios';
import { exportGeoJson, exportProject, importProject } from '../../src/persistence/projectIO';

describe('Szenario-Editor und Datenexport', () => {
  beforeEach(() => useStreetLab.getState().setProject(createDemoProject()));

  it('keeps baseline immutable when a feature is moved or removed in a variant', () => {
    const original = structuredClone(useStreetLab.getState().project.baseFeatures);
    useStreetLab.getState().setEditTarget('scenario');
    useStreetLab.getState().translateFeatureTo('road-main', 8, 6);
    expect(useStreetLab.getState().project.baseFeatures).toEqual(original);
    expect(resolveScenario(useStreetLab.getState().project, 'variant-a').find((feature) => feature.id === 'road-main')?.geometry).not.toEqual(original[0]?.geometry);
    useStreetLab.getState().removeFeature('road-main');
    expect(useStreetLab.getState().project.baseFeatures).toEqual(original);
    expect(resolveScenario(useStreetLab.getState().project, 'variant-a').some((feature) => feature.id === 'road-main')).toBe(false);
    useStreetLab.getState().undo();
    expect(resolveScenario(useStreetLab.getState().project, 'variant-a').some((feature) => feature.id === 'road-main')).toBe(true);
  });

  it('includes scenario additions and modified features in GeoJSON', () => {
    const project = createDemoProject();
    const exported = JSON.parse(exportGeoJson(project)) as { features: { properties: { scenarioId: string | null } }[] };
    expect(exported.features).toHaveLength(project.baseFeatures.length + 1);
    expect(exported.features.at(-1)?.properties.scenarioId).toBe('variant-a');
    expect(importProject(exportProject(project)).scenarios[0]?.additions).toEqual(project.scenarios[0]?.additions);
  });
});
