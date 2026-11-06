export type Id = string;
export type LocalPoint = { x: number; y: number };
export type PolygonXY = LocalPoint[][];
export type FeatureKind = 'street_space' | 'road' | 'sidewalk' | 'building' | 'hard_obstacle' | 'curb';

export type SurfaceFeature = {
  id: Id;
  kind: FeatureKind;
  geometry: PolygonXY;
  properties?: {
    name?: string;
    source?: string;
    uncertaintyM?: number;
    sourceObjectId?: string;
    sourceAttributes?: Record<string, string | number>;
    reference?: boolean;
  };
};

export type Scenario = {
  id: Id;
  name: string;
  baseScenarioId?: Id;
  additions: SurfaceFeature[];
  removedBaseFeatureIds: Id[];
  modifiedBaseFeatures: SurfaceFeature[];
};

export type Project = {
  schemaVersion: 2;
  id: Id;
  title: string;
  centerWgs84: { lon: number; lat: number };
  boundsWgs84: [number, number, number, number];
  geometrySource: string;
  geometryAccuracyNote: string;
  baseFeatures: SurfaceFeature[];
  scenarios: Scenario[];
};
