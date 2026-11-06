import { toWgs84 } from './projection';
import type { Project } from './types';

export function createProject(lon = 8.35, lat = 49.56, title = 'Neuer Straßenentwurf'): Project {
  const centerWgs84 = { lon, lat };
  const a = toWgs84({ x: -170, y: -170 }, centerWgs84);
  const b = toWgs84({ x: 170, y: 170 }, centerWgs84);
  return {
    schemaVersion: 2, id: crypto.randomUUID(), title, centerWgs84,
    boundsWgs84: [a.lon, a.lat, b.lon, b.lat],
    geometrySource: 'Noch keine Flächengrundlage geladen',
    geometryAccuracyNote: 'ALKIS beschreibt Nutzungsflächen; Widmung und verfügbare Planungsfläche sind gesondert zu klären.',
    baseFeatures: [],
    scenarios: [{ id: 'variant-a', name: 'Variante A', additions: [], removedBaseFeatureIds: [], modifiedBaseFeatures: [] }],
  };
}
