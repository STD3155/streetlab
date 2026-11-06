import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/demo/demoProject';

describe('Demo-L-Kurve', () => {
  it('is deterministic and explicitly marked as synthetic', () => {
    const first = createDemoProject();
    const second = createDemoProject();
    expect(first).toEqual(second);
    expect(first.geometrySource).toMatch(/synthetisch/i);
    expect(first.geometryAccuracyNote).toMatch(/nicht als reale Planung/i);
    expect(first.maneuvers[0]?.start).toEqual({ x: 4, y: 6, headingRad: 0 });
  });
});
