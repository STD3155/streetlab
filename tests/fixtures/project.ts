import { createProject } from '../../src/domain/project';
import type { Project } from '../../src/domain/types';

export function projectFixture(): Project {
  const project = createProject();
  project.baseFeatures = [{ id: 'road-main', kind: 'road', geometry: [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }]], properties: { source: 'Synthetischer Test' } }];
  project.scenarios[0]!.additions = [{ id: 'sidewalk', kind: 'sidewalk', geometry: [[{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 12 }, { x: 0, y: 12 }, { x: 0, y: 10 }]] }];
  return project;
}
