import { create } from 'zustand';
import { createDemoProject } from '../demo/demoProject';
import { importProject } from '../persistence/projectIO';
import { isValidPolygon } from '../domain/geometry';
import type { FeatureKind, Project, SimulationResult, SurfaceFeature } from '../domain/types';

export type ToolMode = 'select' | 'road' | 'sidewalk' | 'building' | 'hard_obstacle' | 'island' | 'poller' | 'sidewalk_protection' | 'area' | 'start' | 'goal' | 'move' | 'move_vertex' | 'measure';
type StreetLabState = {
  project: Project;
  past: Project[];
  future: Project[];
  scenarioId: string;
  editTarget: 'base' | 'scenario';
  tool: ToolMode;
  pendingPoints: { x: number; y: number }[];
  selectedFeatureId: string | null;
  results: Record<string, SimulationResult>;
  status: string;
  busy: boolean;
  progress: number;
  playback: number;
  pollerDiameterM: number;
  showBase: boolean;
  showVariant: boolean;
  visibleKinds: Record<FeatureKind, boolean>;
  setTool: (tool: ToolMode) => void;
  addPoint: (point: { x: number; y: number }) => void;
  clearPending: () => void;
  addFeature: (feature: SurfaceFeature, scenario?: boolean) => void;
  removeFeature: (id: string) => void;
  selectFeature: (id: string | null) => void;
  translateFeatureTo: (id: string, x: number, y: number) => void;
  moveVertexTo: (id: string, x: number, y: number) => void;
  setProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  setStatus: (status: string) => void;
  setBusy: (busy: boolean) => void;
  setProgress: (progress: number) => void;
  setResult: (result: SimulationResult) => void;
  clearResults: () => void;
  setPlayback: (playback: number) => void;
  setPollerDiameter: (diameterM: number) => void;
  setVisibility: (base: boolean, variant: boolean) => void;
  setKindVisibility: (kind: FeatureKind, visible: boolean) => void;
  newVariant: () => void;
  setEditTarget: (target: 'base' | 'scenario') => void;
  undo: () => void;
  redo: () => void;
};

function loadProject(): Project {
  try {
    const stored = localStorage.getItem('streetlab.project.v1');
    return stored ? importProject(stored) : createDemoProject();
  } catch { return createDemoProject(); }
}

export const useStreetLab = create<StreetLabState>((set, get) => ({
  project: loadProject(), past: [], future: [], scenarioId: 'variant-a', editTarget: 'base', tool: 'select', pendingPoints: [], selectedFeatureId: null,
  results: {}, status: 'Demo bereit. Geometrie ist synthetisch und unvermessen.', busy: false, progress: 0, playback: 0, pollerDiameterM: 0.4,
  showBase: true, showVariant: true, visibleKinds: { road: true, sidewalk: true, building: true, hard_obstacle: true, curb: true },
  setTool: (tool) => set({ tool, pendingPoints: [] }),
  addPoint: (point) => set((state) => ({ pendingPoints: [...state.pendingPoints, point] })),
  clearPending: () => set({ pendingPoints: [] }),
  addFeature: (feature, scenario = get().editTarget === 'scenario') => {
    const { project, scenarioId } = get();
    const next = structuredClone(project);
    if (scenario) {
      const target = next.scenarios.find((item) => item.id === scenarioId);
      if (target) target.additions.push(feature);
    } else next.baseFeatures.push(feature);
    set({ project: next, past: [...get().past, structuredClone(project)].slice(-20), future: [], results: {}, pendingPoints: [], tool: 'select', status: 'Geometrie geändert – Ergebnisse veraltet; bitte neu berechnen.' });
  },
  removeFeature: (id) => {
    const current = get(); const next = structuredClone(current.project);
    const isBase = next.baseFeatures.some((feature) => feature.id === id);
    if (isBase && current.editTarget === 'scenario') {
      const scenario = next.scenarios.find((item) => item.id === current.scenarioId);
      if (scenario && !scenario.removedBaseFeatureIds.includes(id)) scenario.removedBaseFeatureIds.push(id);
      if (scenario) scenario.modifiedBaseFeatures = scenario.modifiedBaseFeatures.filter((feature) => feature.id !== id);
    } else if (isBase) {
      next.baseFeatures = next.baseFeatures.filter((feature) => feature.id !== id);
      for (const scenario of next.scenarios) {
        scenario.removedBaseFeatureIds = scenario.removedBaseFeatureIds.filter((featureId) => featureId !== id);
        scenario.modifiedBaseFeatures = scenario.modifiedBaseFeatures.filter((feature) => feature.id !== id);
      }
    } else {
      for (const scenario of next.scenarios) scenario.additions = scenario.additions.filter((feature) => feature.id !== id);
    }
    set({ project: next, past: [...current.past, structuredClone(current.project)].slice(-20), future: [], results: {}, selectedFeatureId: null, status: isBase && current.editTarget === 'scenario' ? 'Fläche in dieser Variante entfernt; der Bestand bleibt unverändert.' : 'Fläche entfernt. Simulationsergebnisse wurden verworfen.' });
  },
  selectFeature: (id) => set({ selectedFeatureId: id }),
  translateFeatureTo: (id, x, y) => {
    const current = get(); const next = structuredClone(current.project);
    const base = next.baseFeatures.find((item) => item.id === id);
    const scenario = next.scenarios.find((item) => item.id === current.scenarioId);
    let feature = [...next.scenarios.flatMap((item) => item.additions)].find((item) => item.id === id);
    if (base) {
      if (current.editTarget === 'scenario' && scenario) {
        feature = scenario.modifiedBaseFeatures.find((item) => item.id === id) ?? structuredClone(base);
        if (!scenario.modifiedBaseFeatures.some((item) => item.id === id)) scenario.modifiedBaseFeatures.push(feature);
      } else feature = base;
    }
    if (!feature) return;
    const pts = feature.geometry[0]!;
    const center = pts.slice(0, -1).reduce((sum, p) => ({ x: sum.x + p.x / (pts.length - 1), y: sum.y + p.y / (pts.length - 1) }), { x: 0, y: 0 });
    const dx = x - center.x; const dy = y - center.y;
    feature.geometry = feature.geometry.map((ring) => ring.map((point) => ({ x: point.x + dx, y: point.y + dy })));
    if (!isValidPolygon(feature.geometry) || feature.geometry.flat().some((point) => Math.hypot(point.x, point.y) > 250)) { set({ status: 'Verschiebung verworfen: Polygon wäre ungültig oder außerhalb des Projektbereichs.' }); return; }
    set({ project: next, past: [...current.past, structuredClone(current.project)].slice(-20), future: [], results: {}, status: current.editTarget === 'scenario' ? 'Fläche nur in der Variante verschoben; Ergebnisse veraltet.' : 'Fläche verschoben – Ergebnisse veraltet.' });
  },
  moveVertexTo: (id, x, y) => {
    const current = get(); const next = structuredClone(current.project);
    const base = next.baseFeatures.find((item) => item.id === id);
    const scenario = next.scenarios.find((item) => item.id === current.scenarioId);
    let feature = [...next.scenarios.flatMap((item) => item.additions)].find((item) => item.id === id);
    if (base) {
      if (current.editTarget === 'scenario' && scenario) {
        feature = scenario.modifiedBaseFeatures.find((item) => item.id === id) ?? structuredClone(base);
        if (!scenario.modifiedBaseFeatures.some((item) => item.id === id)) scenario.modifiedBaseFeatures.push(feature);
      } else feature = base;
    }
    if (!feature) return;
    let closest: { ringIndex: number; pointIndex: number; distance: number } | undefined;
    for (let ringIndex = 0; ringIndex < feature.geometry.length; ringIndex += 1) {
      const ring = feature.geometry[ringIndex]!;
      for (let pointIndex = 0; pointIndex < ring.length - 1; pointIndex += 1) {
        const point = ring[pointIndex]!;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (!closest || distance < closest.distance) closest = { ringIndex, pointIndex, distance };
      }
    }
    if (!closest || closest.distance > 4) { set({ status: 'Kein Stützpunkt innerhalb von 4 m. Wählen Sie eine Fläche und klicken Sie näher am Eckpunkt.' }); return; }
    const vertex = closest;
    const old = feature.geometry[vertex.ringIndex]![vertex.pointIndex]!;
    const dx = x - old.x; const dy = y - old.y;
    feature.geometry[vertex.ringIndex] = feature.geometry[vertex.ringIndex]!.map((point, index, ring) => {
      if (index === vertex.pointIndex || (index === ring.length - 1 && vertex.pointIndex === 0)) return { x: point.x + dx, y: point.y + dy };
      return point;
    });
    if (!isValidPolygon(feature.geometry) || feature.geometry.flat().some((point) => Math.hypot(point.x, point.y) > 250)) { set({ status: 'Stützpunktänderung verworfen: Polygon wäre ungültig oder außerhalb des Projektbereichs.' }); return; }
    set({ project: next, past: [...current.past, structuredClone(current.project)].slice(-20), future: [], results: {}, status: 'Stützpunkt verschoben – Ergebnisse veraltet.' });
  },
  setProject: (project) => set({ project, past: [], future: [], editTarget: 'base', scenarioId: project.scenarios[0]?.id ?? '', results: {}, status: `Projekt „${project.title}“ geladen.` }),
  updateProject: (project) => set({ project, past: [...get().past, structuredClone(get().project)].slice(-20), future: [], results: {}, status: 'Projekt geändert – Ergebnisse veraltet.' }),
  setStatus: (status) => set({ status }),
  setBusy: (busy) => set({ busy }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set((state) => ({ results: { ...state.results, [result.scenarioId]: result }, status: result.status === 'success' ? `Berechnung abgeschlossen (${result.path.length} Posen).` : result.warnings[0] ?? result.status })),
  clearResults: () => set({ results: {} }),
  setPlayback: (playback) => set({ playback }),
  setPollerDiameter: (pollerDiameterM) => set({ pollerDiameterM: Math.max(0.1, Math.min(2, pollerDiameterM)) }),
  setVisibility: (showBase, showVariant) => set({ showBase, showVariant }),
  setKindVisibility: (kind, visible) => set((state) => ({ visibleKinds: { ...state.visibleKinds, [kind]: visible } })),
  newVariant: () => {
    const next = structuredClone(get().project);
    const id = `variant-${next.scenarios.length + 1}`;
    next.scenarios.push({ id, name: `Variante ${String.fromCharCode(65 + next.scenarios.length)}`, additions: [], removedBaseFeatureIds: [], modifiedBaseFeatures: [] });
    set({ project: next, past: [...get().past, structuredClone(get().project)].slice(-20), future: [], scenarioId: id, editTarget: 'scenario', results: {}, status: `${next.scenarios.at(-1)!.name} angelegt.` });
  },
  setEditTarget: (editTarget) => set({ editTarget, tool: 'select', pendingPoints: [] }),
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    const previous = past.at(-1)!;
    set({ project: previous, past: past.slice(0, -1), future: [...future, structuredClone(project)], results: {}, status: 'Letzte Änderung rückgängig gemacht; Simulationsergebnisse verworfen.' });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    const next = future.at(-1)!;
    set({ project: next, past: [...past, structuredClone(project)].slice(-20), future: future.slice(0, -1), results: {}, status: 'Änderung wiederhergestellt; Simulationsergebnisse verworfen.' });
  },
}));

let storageErrorReported = false;
if (typeof window !== 'undefined') {
  useStreetLab.subscribe((state) => {
    try { localStorage.setItem('streetlab.project.v1', JSON.stringify(state.project)); storageErrorReported = false; }
    catch { if (!storageErrorReported) { storageErrorReported = true; useStreetLab.setState({ status: 'Lokales Speichern fehlgeschlagen (Speicher voll oder gesperrt).' }); } }
  });
}
