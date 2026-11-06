import { beforeEach, describe, expect, it } from 'vitest';
import { useStreetLab } from '../../src/app/store';
import { projectFixture } from '../fixtures/project';
import { resolveScenario } from '../../src/domain/scenarios';
import { exportGeoJson, exportProject, importProject } from '../../src/persistence/projectIO';

describe('Szenario-Editor und Datenexport', () => {
  beforeEach(() => useStreetLab.getState().setProject(projectFixture()));

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
    const project = projectFixture();
    const exported = JSON.parse(exportGeoJson(project)) as { features: { properties: { scenarioId: string | null } }[] };
    expect(exported.features).toHaveLength(project.baseFeatures.length + 1);
    expect(exported.features.at(-1)?.properties.scenarioId).toBe('variant-a');
    expect(importProject(exportProject(project)).scenarios[0]?.additions).toEqual(project.scenarios[0]?.additions);
  });
});

describe('Referenzschutz und Editorzustand', () => {
  it('prevents modification and deletion of ALKIS references', () => {
    const project = projectFixture();
    project.baseFeatures[0]!.kind = 'street_space';
    project.baseFeatures[0]!.properties = { reference: true, source: 'ALKIS' };
    useStreetLab.getState().setProject(project);
    const original = structuredClone(project);
    useStreetLab.getState().translateFeatureTo('road-main', 7, 7);
    useStreetLab.getState().moveVertexTo('road-main', 1, 1);
    useStreetLab.getState().removeFeature('road-main');
    expect(useStreetLab.getState().project).toEqual(original);
  });

  it('keeps a valid scenario selection after undoing variant creation', () => {
    useStreetLab.getState().setProject(projectFixture());
    useStreetLab.getState().newVariant();
    useStreetLab.getState().undo();
    const state = useStreetLab.getState();
    expect(() => resolveScenario(state.project, state.scenarioId)).not.toThrow();
    useStreetLab.getState().redo();
    expect(useStreetLab.getState().project.scenarios).toHaveLength(2);
  });
});
