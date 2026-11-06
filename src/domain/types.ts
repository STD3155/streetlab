export type Id = string;
export type LocalPoint = { x: number; y: number };
export type Pose = LocalPoint & { headingRad: number };
export type PolygonXY = LocalPoint[][];
export type FeatureKind = 'road' | 'sidewalk' | 'building' | 'hard_obstacle' | 'curb';
export type DriveMode = 'road_only' | 'diagnostic_sidewalk_allowed';

export type SurfaceFeature = {
  id: Id;
  kind: FeatureKind;
  geometry: PolygonXY;
  properties?: {
    name?: string;
    source?: string;
    uncertaintyM?: number;
    diameterM?: number;
    sourceObjectId?: string;
    sourceAttributes?: Record<string, string | number>;
    widthSource?: string;
  };
};

export type VehicleSpec = {
  id: Id;
  label: string;
  lengthM: number;
  widthM: number;
  wheelbaseM: number;
  frontOverhangM: number;
  rearOverhangM: number;
  maxSteerRad: number;
};

export type Maneuver = {
  id: Id;
  name: string;
  start: Pose;
  goal: Pose;
  vehicleId: Id;
  driveMode: DriveMode;
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
  schemaVersion: 1;
  id: Id;
  title: string;
  centerWgs84: { lon: number; lat: number };
  boundsWgs84: [number, number, number, number];
  geometrySource: string;
  geometryAccuracyNote: string;
  baseFeatures: SurfaceFeature[];
  vehicleSpecs: VehicleSpec[];
  maneuvers: Maneuver[];
  scenarios: Scenario[];
};

export type SimulationResult = {
  scenarioId: Id;
  maneuverId: Id;
  status: 'success' | 'no_path_found' | 'timeout' | 'invalid_input';
  path: Pose[];
  sweptArea: PolygonXY[] | null;
  lengthM?: number;
  minObstacleClearanceM?: number;
  sidewalkOverlapAreaM2?: number;
  sidewalkTouched?: boolean;
  hardCollision?: boolean;
  computeTimeMs: number;
  settings: Record<string, unknown>;
  warnings: string[];
};

export type PlanningRequest = {
  start: Pose;
  goal: Pose;
  vehicle: VehicleSpec;
  road: PolygonXY[];
  sidewalks: PolygonXY[];
  obstacles: PolygonXY[];
  mode: DriveMode;
  maxExpansions?: number;
  timeoutMs?: number;
  gridM?: number;
  headingBins?: number;
};

export type PlanningResult = {
  status: SimulationResult['status'];
  path: Pose[];
  expansions: number;
  elapsedMs: number;
  reason?: string;
};
