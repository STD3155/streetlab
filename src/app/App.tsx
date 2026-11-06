import { useEffect, useRef, useState } from 'react';
import { createDemoProject } from '../demo/demoProject';
import { closeRing, isValidPolygon } from '../domain/geometry';
import { toWgs84 } from '../domain/projection';
import { resolveScenario } from '../domain/scenarios';
import type { DriveMode, FeatureKind, PlanningRequest, SimulationResult, SurfaceFeature } from '../domain/types';
import { exportGeoJson, exportProject, importProject } from '../persistence/projectIO';
import { calculateMetrics } from '../simulation/metrics';
import { calculateSweptArea } from '../simulation/sweptArea';
import { planInWorker } from '../simulation/worker';
import { StreetMap } from '../map/StreetMap';
import { fetchSource, type ImportSource } from '../map/dataSources';
import { useStreetLab, type ToolMode } from './store';

const featureLabels: Record<FeatureKind, string> = { road: 'Fahrbahn', sidewalk: 'Gehweg', building: 'Gebäude', hard_obstacle: 'Hindernis', curb: 'Bordkante' };
const toolOptions: { mode: ToolMode; label: string; icon: string }[] = [
  { mode: 'road', label: 'Fahrbahn', icon: '▰' }, { mode: 'sidewalk', label: 'Gehweg', icon: '▱' },
  { mode: 'building', label: 'Gebäude', icon: '⌂' }, { mode: 'hard_obstacle', label: 'Hindernis', icon: '▧' },
  { mode: 'island', label: 'Verkehrsinsel', icon: '◈' }, { mode: 'poller', label: 'Poller (Ø 0,4 m)', icon: '●' },
  { mode: 'sidewalk_protection', label: 'Gehwegschutz', icon: '▤' }, { mode: 'area', label: 'Bereich aufziehen', icon: '□' },
  { mode: 'start', label: 'Start setzen', icon: 'A' },
  { mode: 'goal', label: 'Ziel setzen', icon: 'B' }, { mode: 'move', label: 'Fläche verschieben', icon: '✥' },
  { mode: 'move_vertex', label: 'Stützpunkt verschieben', icon: '⌖' }, { mode: 'measure', label: 'Abstand messen', icon: '↔' },
];

function defaultProject(lon: number, lat: number, title: string) {
  const centerWgs84 = { lon, lat };
  const a = toWgs84({ x: -170, y: -170 }, centerWgs84); const b = toWgs84({ x: 170, y: 170 }, centerWgs84);
  return {
    schemaVersion: 1 as const, id: crypto.randomUUID(), title, centerWgs84, boundsWgs84: [a.lon, a.lat, b.lon, b.lat] as [number, number, number, number],
    geometrySource: 'Nutzerdefinierte lokale Erfassung', geometryAccuracyNote: 'Geometrie und Maße wurden nicht unabhängig vermessen.',
    baseFeatures: [] as SurfaceFeature[], vehicleSpecs: createDemoProject().vehicleSpecs,
    maneuvers: [{ id: crypto.randomUUID(), name: 'Fahrmanöver 1', start: { x: 0, y: 0, headingRad: 0 }, goal: { x: 10, y: 10, headingRad: Math.PI / 2 }, vehicleId: 'demo-car', driveMode: 'road_only' as DriveMode }],
    scenarios: [{ id: 'variant-a', name: 'Variante A', additions: [] as SurfaceFeature[], removedBaseFeatureIds: [], modifiedBaseFeatures: [] }],
  };
}

function triggerDownload(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function requestFor(project: ReturnType<typeof createDemoProject>, scenarioId: string): PlanningRequest {
  const maneuver = project.maneuvers[0]!;
  const features = scenarioId === 'base' ? project.baseFeatures : resolveScenario(project, scenarioId);
  const obstacleKinds: FeatureKind[] = ['building', 'hard_obstacle'];
  return {
    start: maneuver.start, goal: maneuver.goal,
    vehicle: project.vehicleSpecs.find((vehicle) => vehicle.id === maneuver.vehicleId)!,
    road: features.filter((feature) => feature.kind === 'road').map((feature) => feature.geometry),
    sidewalks: features.filter((feature) => feature.kind === 'sidewalk').map((feature) => feature.geometry),
    obstacles: features.filter((feature) => obstacleKinds.includes(feature.kind)).map((feature) => feature.geometry),
    mode: maneuver.driveMode, timeoutMs: 12000, maxExpansions: 45000, gridM: 0.5, headingBins: 24,
  };
}

export function App() {
  const project = useStreetLab((state) => state.project);
  const scenarioId = useStreetLab((state) => state.scenarioId);
  const tool = useStreetLab((state) => state.tool);
  const editTarget = useStreetLab((state) => state.editTarget);
  const pendingPoints = useStreetLab((state) => state.pendingPoints);
  const selectedFeatureId = useStreetLab((state) => state.selectedFeatureId);
  const results = useStreetLab((state) => state.results);
  const status = useStreetLab((state) => state.status);
  const busy = useStreetLab((state) => state.busy);
  const progress = useStreetLab((state) => state.progress);
  const playback = useStreetLab((state) => state.playback);
  const pollerDiameterM = useStreetLab((state) => state.pollerDiameterM);
  const showBase = useStreetLab((state) => state.showBase);
  const showVariant = useStreetLab((state) => state.showVariant);
  const visibleKinds = useStreetLab((state) => state.visibleKinds);
  const [coords, setCoords] = useState('50.0000, 9.0000');
  const [isPlaying, setIsPlaying] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>('alkis');
  const [importingGeometry, setImportingGeometry] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const activePlan = useRef<AbortController | null>(null);
  const maneuver = project.maneuvers[0]!;
  const variant = project.scenarios.find((scenario) => scenario.id === scenarioId);
  const baseFeatures = project.baseFeatures;
  const variantFeatures = variant?.additions ?? [];
  const baseResult = results.base;
  const variantResult = variant ? results[variant.id] : undefined;
  const selected = [...baseFeatures, ...project.scenarios.flatMap((scenario) => scenario.additions)].find((feature) => feature.id === selectedFeatureId);
  const toolName = toolOptions.find((option) => option.mode === tool)?.label ?? 'Auswahl';
  const liveResult = variantResult?.status === 'success' ? variantResult : baseResult;
  const pathCount = liveResult?.path.length ?? 0;

  useEffect(() => {
    if (!isPlaying || !pathCount) return;
    const timer = window.setInterval(() => {
      const current = useStreetLab.getState().playback;
      if (current >= 1) { useStreetLab.getState().setPlayback(0); setIsPlaying(false); }
      else useStreetLab.getState().setPlayback(Math.min(1, current + 0.008));
    }, 40);
    return () => window.clearInterval(timer);
  }, [isPlaying, pathCount]);

  async function runScenario(id: string) {
    const state = useStreetLab.getState();
    const currentProject = state.project;
    state.setBusy(true); state.setProgress(0); state.setStatus(`Planung für ${id === 'base' ? 'Bestand' : currentProject.scenarios.find((item) => item.id === id)?.name ?? id} läuft …`);
    const started = performance.now();
    try {
      const request = requestFor(currentProject, id);
      const features = id === 'base' ? currentProject.baseFeatures : resolveScenario(currentProject, id);
      if (features.some((feature) => !isValidPolygon(feature.geometry))) throw new Error('Ungültige Polygongeometrie. Simulation gesperrt; bitte Fläche bearbeiten oder entfernen.');
      if (!request.road.length) throw new Error('Keine Fahrbahnfläche erfasst.');
      const planned = await planInWorker(request, { onProgress: (value) => useStreetLab.getState().setProgress(value) }, activePlan.current?.signal);
      const result: SimulationResult = {
        scenarioId: id, maneuverId: currentProject.maneuvers[0]!.id,
        status: planned.status, path: planned.path, sweptArea: planned.status === 'success' ? calculateSweptArea(planned.path, request.vehicle) : null,
        computeTimeMs: performance.now() - started, settings: { maxExpansions: request.maxExpansions, timeoutMs: request.timeoutMs, gridM: request.gridM, headingBins: request.headingBins, planner: 'Vorwärts-State-Lattice A*' },
        warnings: planned.reason ? [planned.reason] : [],
      };
      if (planned.status === 'success' && !result.sweptArea) result.warnings.push('Schleppflächenvereinigung fehlgeschlagen; Fläche wird nicht dargestellt.');
      if (planned.status === 'success') {
        const metrics = calculateMetrics(planned.path, request.vehicle, request.obstacles, request.sidewalks);
        Object.assign(result, metrics);
        if (planned.path.length) {
          const end = planned.path.at(-1)!;
          const deviation = Math.hypot(end.x - request.goal.x, end.y - request.goal.y);
          if (deviation > 0.1) result.warnings.push(`Endpose liegt ${deviation.toFixed(2)} m vom Zielmarker entfernt (Suchgitter-Toleranz).`);
        }
      }
      useStreetLab.getState().setResult(result);
      return result;
    } catch (error) {
      useStreetLab.getState().setBusy(false);
      useStreetLab.getState().setStatus(error instanceof Error ? error.message : 'Planung fehlgeschlagen.');
      return null;
    }
  }

  async function calculateBoth() {
    if (!maneuver) return;
    activePlan.current?.abort();
    activePlan.current = new AbortController();
    useStreetLab.getState().clearResults();
    try {
      const base = await runScenario('base');
      if (base) await runScenario(scenarioId);
    } finally {
      activePlan.current = null;
      useStreetLab.getState().setBusy(false);
    }
  }

  function finishPolygon() {
    if (pendingPoints.length < 3) { useStreetLab.getState().setStatus('Ein Polygon benötigt mindestens drei Stützpunkte.'); return; }
    const geometry = [closeRing(pendingPoints)];
    if (!isValidPolygon(geometry)) { useStreetLab.getState().setStatus('Ungültiges Polygon. Prüfen Sie die Stützpunkte auf Selbstüberschneidungen und Fläche.'); return; }
    if (pendingPoints.some((point) => Math.hypot(point.x, point.y) > 250)) { useStreetLab.getState().setStatus('Polygon liegt außerhalb des maximal 500 m großen Projektbereichs.'); return; }
    const kind: FeatureKind = tool === 'island' || tool === 'sidewalk_protection' ? 'hard_obstacle' : tool as FeatureKind;
    const name = tool === 'island' ? 'Verkehrsinsel' : tool === 'sidewalk_protection' ? 'Gehwegschutz' : featureLabels[kind];
    const feature: SurfaceFeature = { id: crypto.randomUUID(), kind, geometry, properties: { name, source: 'Nutzereingabe' } };
    useStreetLab.getState().addFeature(feature, ['island', 'sidewalk_protection'].includes(tool) || editTarget === 'scenario');
  }

  function setHeading(which: 'start' | 'goal', degrees: number) {
    const next = structuredClone(useStreetLab.getState().project);
    next.maneuvers[0]![which].headingRad = degrees * Math.PI / 180;
    useStreetLab.getState().updateProject(next);
  }

  function updateVehicle(key: 'lengthM' | 'widthM' | 'wheelbaseM' | 'frontOverhangM' | 'rearOverhangM' | 'maxSteerRad', value: number) {
    if (!Number.isFinite(value)) return;
    const next = structuredClone(useStreetLab.getState().project);
    const vehicle = next.vehicleSpecs.find((spec) => spec.id === maneuver.vehicleId);
    if (!vehicle) return;
    if (key === 'maxSteerRad') vehicle.maxSteerRad = Math.max(0.1, Math.min(1.0, value * Math.PI / 180));
    else {
      const minimum = key === 'wheelbaseM' ? 1 : key === 'widthM' ? 1.2 : key.endsWith('OverhangM') ? 0.1 : 3;
      const maximum = key === 'wheelbaseM' ? 5 : key === 'widthM' ? 3.5 : key.endsWith('OverhangM') ? 2.5 : 12;
      vehicle[key] = Math.max(minimum, Math.min(maximum, value));
      if (key === 'lengthM' || key === 'wheelbaseM') {
        const front = vehicle.lengthM - vehicle.wheelbaseM - vehicle.rearOverhangM;
        if (front < 0.1) { useStreetLab.getState().setStatus('Fahrzeuglänge muss Radstand und Überhänge umfassen.'); return; }
        vehicle.frontOverhangM = front;
      }
      if (key === 'frontOverhangM' || key === 'rearOverhangM') vehicle.lengthM = vehicle.wheelbaseM + vehicle.frontOverhangM + vehicle.rearOverhangM;
    }
    useStreetLab.getState().updateProject(next);
  }

  function goToCoordinates(event: React.FormEvent) {
    event.preventDefault();
    const [latText, lonText] = coords.split(',').map((part) => part.trim());
    const lat = Number(latText); const lon = Number(lonText);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { useStreetLab.getState().setStatus('Koordinatenformat: Breitengrad, Längengrad (WGS84).'); return; }
    if (confirm('Neues Gebiet öffnen? Vorhandene Geometrie wird durch ein leeres Projekt ersetzt.')) useStreetLab.getState().setProject(defaultProject(lon, lat, `Straßenraum ${lat.toFixed(4)}, ${lon.toFixed(4)}`));
  }

  async function importFile(file?: File) {
    if (!file) return;
    try { useStreetLab.getState().setProject(importProject(await file.text())); }
    catch (error) { useStreetLab.getState().setStatus(error instanceof Error ? `Import abgelehnt: ${error.message}` : 'Projektdatei konnte nicht importiert werden.'); }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function importMapGeometry() {
    const current = useStreetLab.getState().project;
    if (current.baseFeatures.length && !confirm('Die aktuellen Bestandsflächen und Variantenänderungen durch den gewählten Kartendatensatz ersetzen?')) return;
    const controller = new AbortController();
    setImportingGeometry(true);
    useStreetLab.getState().setStatus(`${importSource === 'alkis' ? 'ALKIS' : 'OpenStreetMap'}-Geometrie wird für den Ausschnitt abgerufen …`);
    try {
      const imported = await fetchSource(importSource, current.boundsWgs84, current.centerWgs84, controller.signal);
      if (!imported.features.length) throw new Error('Der Ausschnitt enthält keine passenden Flächen. Bitte einen anderen Kartenausschnitt wählen.');
      const now = new Date().toISOString().slice(0, 10);
      const next = structuredClone(current);
      next.baseFeatures = imported.features;
      for (const scenario of next.scenarios) {
        scenario.additions = [];
        scenario.removedBaseFeatureIds = [];
        scenario.modifiedBaseFeatures = [];
      }
      next.geometrySource = imported.source === 'alkis'
        ? `©GeoBasis-DE / LVermGeoRP ${now}, dl-de/by-2-0; ALKIS-RLP [Daten bearbeitet]`
        : `© OpenStreetMap-Mitwirkende ${now}, ODbL 1.0; Daten bearbeitet`;
      next.geometryAccuracyNote = imported.notes.join(' ');
      useStreetLab.getState().setProject(next);
      useStreetLab.getState().setStatus(`${imported.source === 'alkis' ? 'ALKIS' : 'OSM'} geladen: ${imported.counts.roads} Straßenflächen, ${imported.counts.buildings} Gebäude, ${imported.counts.sidewalks} ausdrücklich kartierte Gehwegflächen.${imported.counts.skipped ? ` ${imported.counts.skipped} ungültige oder nicht unterstützte Objekte ausgelassen.` : ''} ${imported.notes[1] ?? ''} ${imported.notes.at(-1) ?? ''}`);
    } catch (error) {
      useStreetLab.getState().setStatus(error instanceof Error ? `Geometrieimport fehlgeschlagen: ${error.message}` : 'Geometrieimport fehlgeschlagen.');
    } finally { setImportingGeometry(false); }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">S</div><div><strong>StreetLab</strong><span>Geometrisches Straßenraum-Labor</span></div></div>
      <div className="project-title"><span>PROJEKT</span><strong>{project.title}</strong><small>{project.geometrySource}</small></div>
      <div className="top-actions">
        <button className="icon-button" title="Rückgängig" aria-label="Rückgängig" disabled={!useStreetLab.getState().past.length} onClick={() => useStreetLab.getState().undo()}>↶</button>
        <button className="icon-button" title="Wiederholen" aria-label="Wiederholen" disabled={!useStreetLab.getState().future.length} onClick={() => useStreetLab.getState().redo()}>↷</button>
        <button className="button button-quiet" onClick={() => useStreetLab.getState().setProject(createDemoProject())}>Demo laden</button>
        <button className="button button-quiet" onClick={() => { if (confirm('Aktuelles Projekt durch ein leeres Projekt ersetzen?')) useStreetLab.getState().setProject(defaultProject(project.centerWgs84.lon, project.centerWgs84.lat, 'Neues Straßenraum-Projekt')); }}>Neues Projekt</button>
        <button className="button button-quiet" onClick={() => { const title = prompt('Projektname', project.title)?.trim(); if (title) { const next = structuredClone(project); next.title = title; useStreetLab.getState().updateProject(next); } }}>Umbenennen</button>
        <button className="button button-quiet" onClick={() => fileInput.current?.click()}>Import</button>
        <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
        <button className="button button-primary" onClick={() => triggerDownload(`${project.title.replaceAll(/[^a-z0-9-]/gi, '-')}.json`, exportProject(project))}>Projekt exportieren</button>
        <button className="icon-button" aria-label="GeoJSON exportieren" title="Eigene Geometrie als GeoJSON exportieren" onClick={() => triggerDownload('streetlab-geometry.geojson', exportGeoJson(project), 'application/geo+json')}>↧</button>
      </div>
    </header>

    <section className="workspace">
      <aside className="sidebar left-panel">
        <section className="panel-section location-section">
          <div className="section-title"><span className="step">01</span><h2>Projektbereich</h2></div>
          <form onSubmit={goToCoordinates} className="coordinate-form">
            <label htmlFor="coordinates">Koordinaten suchen <span>WGS84 · lat, lon</span></label>
            <div className="input-row"><input id="coordinates" value={coords} onChange={(event) => setCoords(event.target.value)} /><button className="small-button" type="submit" title="Neues Gebiet öffnen">↗</button></div>
          </form>
          <p className="micro-copy">Karte verschieben oder Zielkoordinaten eingeben. Ein neues Gebiet erstellt ein leeres, lokales Projekt.</p>
          <label className="field-label" htmlFor="geometry-source">Geometriedatenquelle</label>
          <select id="geometry-source" className="source-select" value={importSource} onChange={(event) => setImportSource(event.target.value as ImportSource)}>
            <option value="alkis">ALKIS Rheinland-Pfalz · amtliche Flächen</option>
            <option value="osm">OpenStreetMap · ergänzende Kartierung</option>
          </select>
          <button className="button osm-button" onClick={() => void importMapGeometry()} disabled={importingGeometry || busy}>{importingGeometry ? 'Geometrie wird geladen …' : importSource === 'alkis' ? 'ALKIS-Geometrie übernehmen' : 'OSM-Geometrie übernehmen'}</button>
          <p className="osm-attribution">{importSource === 'alkis' ? <>©GeoBasis-DE / LVermGeoRP, Datenlizenz Deutschland – Namensnennung 2.0. Nur Rheinland-Pfalz.</> : <>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap-Mitwirkende</a>, ODbL 1.0. Straßenbreiten können Schätzwerte sein.</>}</p>
        </section>

        <section className="panel-section">
          <div className="section-title"><span className="step">02</span><h2>Geometrie erfassen</h2></div>
          <div className="tool-grid">
            {toolOptions.map((option) => <button key={option.mode} className={`tool-button ${tool === option.mode ? 'active' : ''}`} onClick={() => useStreetLab.getState().setTool(tool === option.mode ? 'select' : option.mode)} aria-pressed={tool === option.mode}>
              <span className="tool-icon">{option.icon}</span><span>{option.label}</span>
            </button>)}
          </div>
          {(toolOptions.some((option) => option.mode === tool && ['road', 'sidewalk', 'building', 'hard_obstacle', 'island', 'sidewalk_protection'].includes(option.mode))) && <div className="draw-actions"><span>{pendingPoints.length} Stützpunkte</span><button className="small-button" onClick={finishPolygon} disabled={pendingPoints.length < 3}>Polygon abschließen</button><button className="text-button" onClick={() => useStreetLab.getState().clearPending()}>Verwerfen</button></div>}
          {tool === 'area' && <p className="micro-copy">Zwei gegenüberliegende Ecken anklicken. Projektbereich maximal 500 m.</p>}
          {tool === 'poller' && <label className="poller-size">Poller-Durchmesser (m)<input aria-label="Poller-Durchmesser (m)" type="number" min="0.1" max="2" step="0.1" value={pollerDiameterM} onChange={(event) => useStreetLab.getState().setPollerDiameter(Number(event.target.value))} /></label>}
          {tool === 'move' && <p className="micro-copy">Zuerst Fläche auswählen, dann auf die neue Mittelpunktsposition klicken.</p>}
          {tool === 'move_vertex' && <p className="micro-copy">Fläche auswählen, anschließend innerhalb von 4 m auf den zu verschiebenden Eckpunkt klicken.</p>}
          {tool === 'measure' && <p className="micro-copy">Klicken Sie nacheinander zwei Punkte auf der Karte.</p>}
          <div className="layer-list">
            <div className="layer-heading">Sichtbare Ebenen <span>Simulationsebenen</span></div>
            <label className="layer-row"><input type="checkbox" checked={showBase} onChange={(event) => useStreetLab.getState().setVisibility(event.target.checked, showVariant)} /><i className="swatch road" /> Bestand <small>{baseFeatures.length}</small></label>
            <label className="layer-row"><input type="checkbox" checked={showVariant} onChange={(event) => useStreetLab.getState().setVisibility(showBase, event.target.checked)} /><i className="swatch variant" /> {variant?.name ?? 'Variante'} <small>{variantFeatures.length}</small></label>
            <div className="layer-legend">{([['road', 'Fahrbahn'], ['sidewalk', 'Gehweg'], ['building', 'Gebäude'], ['hard_obstacle', 'Hindernis / Insel'], ['curb', 'Bordkante']] as [FeatureKind, string][]).map(([kind, label]) => <label key={kind}><input type="checkbox" checked={visibleKinds[kind]} onChange={(event) => useStreetLab.getState().setKindVisibility(kind, event.target.checked)} /><i className={`swatch ${kind}`} /> {label}</label>)}</div>
            {selected && <div className="selected-feature"><span>Ausgewählt: {selected.properties?.name ?? featureLabels[selected.kind]}</span><button className="text-button danger" onClick={() => useStreetLab.getState().removeFeature(selected.id)}>Entfernen</button></div>}
          </div>
        </section>

        <section className="panel-section maneuver-section">
          <div className="section-title"><span className="step">03</span><h2>Manöver & Fahrzeug</h2></div>
          <div className="pose-control"><div><strong>Startpose</strong><span>Hinterachsmitte</span></div><label><input type="number" min="-180" max="180" step="5" value={Math.round(maneuver.start.headingRad * 180 / Math.PI)} onChange={(event) => setHeading('start', Number(event.target.value))} /> °</label></div>
          <div className="pose-control"><div><strong>Zielpose</strong><span>Hinterachsmitte</span></div><label><input type="number" min="-180" max="180" step="5" value={Math.round(maneuver.goal.headingRad * 180 / Math.PI)} onChange={(event) => setHeading('goal', Number(event.target.value))} /> °</label></div>
          <label className="field-label" htmlFor="drive-mode">Fahrmodus</label>
          <select id="drive-mode" value={maneuver.driveMode} onChange={(event) => { const next = structuredClone(project); next.maneuvers[0]!.driveMode = event.target.value as DriveMode; useStreetLab.getState().updateProject(next); }}>
            <option value="road_only">Nur Fahrbahn (geometrische Grenze)</option><option value="diagnostic_sidewalk_allowed">Diagnostisch: Gehweg erlaubt</option>
          </select>
          <div className="vehicle-card"><div className="vehicle-glyph">▰</div><div><strong>{project.vehicleSpecs[0]?.label}</strong><span>{project.vehicleSpecs[0]?.lengthM.toFixed(2)} × {project.vehicleSpecs[0]?.widthM.toFixed(2)} m · Radstand {project.vehicleSpecs[0]?.wheelbaseM.toFixed(2)} m</span></div><small>MODELL</small></div>
          <details className="vehicle-editor"><summary>Fahrzeugparameter bearbeiten</summary><div className="vehicle-inputs">
            <label>Länge (m)<input type="number" min="3" max="8" step="0.1" defaultValue={project.vehicleSpecs[0]?.lengthM} onBlur={(event) => updateVehicle('lengthM', Number(event.target.value))} /></label>
            <label>Breite (m)<input type="number" min="1.4" max="3" step="0.05" defaultValue={project.vehicleSpecs[0]?.widthM} onBlur={(event) => updateVehicle('widthM', Number(event.target.value))} /></label>
            <label>Radstand (m)<input type="number" min="1.8" max="5" step="0.05" defaultValue={project.vehicleSpecs[0]?.wheelbaseM} onBlur={(event) => updateVehicle('wheelbaseM', Number(event.target.value))} /></label>
            <label>Frontüberhang (m)<input type="number" min="0.1" max="2.5" step="0.05" defaultValue={project.vehicleSpecs[0]?.frontOverhangM} onBlur={(event) => updateVehicle('frontOverhangM', Number(event.target.value))} /></label>
            <label>Hecküberhang (m)<input type="number" min="0.1" max="2.5" step="0.05" defaultValue={project.vehicleSpecs[0]?.rearOverhangM} onBlur={(event) => updateVehicle('rearOverhangM', Number(event.target.value))} /></label>
            <label>Max. Lenkwinkel (°)<input type="number" min="10" max="55" step="1" defaultValue={project.vehicleSpecs[0] ? Math.round(project.vehicleSpecs[0].maxSteerRad * 180 / Math.PI) : 32} onBlur={(event) => updateVehicle('maxSteerRad', Number(event.target.value))} /></label>
          </div><small>Überhänge: hinten {project.vehicleSpecs[0]?.rearOverhangM.toFixed(2)} m · vorne {project.vehicleSpecs[0]?.frontOverhangM.toFixed(2)} m</small></details>
          <div className="scenario-select"><label htmlFor="scenario">Vergleichsszenario</label><select id="scenario" value={scenarioId} onChange={(event) => { useStreetLab.setState({ scenarioId: event.target.value, results: {} }); }}>
            {project.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
          </select><label className="edit-target-label">Geometrie bearbeiten</label><div className="edit-toggle"><button className={editTarget === 'base' ? 'active' : ''} onClick={() => useStreetLab.getState().setEditTarget('base')}>Bestand</button><button className={editTarget === 'scenario' ? 'active' : ''} onClick={() => useStreetLab.getState().setEditTarget('scenario')}>Variante</button></div><button className="text-button" onClick={() => useStreetLab.getState().newVariant()}>＋ Neue Variante</button></div>
        </section>
      </aside>

      <section className="map-column">
        <div className="map-toolbar"><div className="map-heading"><span className="live-dot" /><strong>{tool === 'select' ? 'Karte' : toolName}</strong><span>{tool === 'select' ? 'Verschieben · Zoomen · Auswählen' : 'Klicken Sie auf die Karte'}</span></div><div className="map-badges"><span>AEQD · lokal metrisch</span><span>500 m max.</span></div></div>
        <div className="map-frame"><StreetMap /></div>
        <div className="map-footer"><span title={project.geometryAccuracyNote}><b>●</b> {project.geometryAccuracyNote}</span><span>Maßstab in m</span></div>
        <div className="map-legend"><span><i className="line-sample base" /> Bestand</span><span><i className="line-sample variant" /> Variante</span><span><i className="area-sample" /> Schleppfläche</span><span><i className="marker-sample">A</i> Start / Ziel</span></div>
      </section>

      <aside className="sidebar right-panel">
        <section className="panel-section calculate-section">
          <div className="section-title"><span className="step">04</span><h2>Berechnung</h2></div>
          <button className="button button-primary calculate-button" onClick={() => void calculateBoth()} disabled={busy}><span className="calculate-icon">{busy ? '◌' : '⌁'}</span>{busy ? 'Berechnung läuft …' : 'Bestand & Variante berechnen'}</button>
          {busy && <div className="progress-wrap"><div className="progress-bar"><i style={{ width: `${Math.min(96, progress / 45000 * 100)}%` }} /></div><button className="text-button danger" onClick={() => activePlan.current?.abort()}>Abbrechen</button></div>}
          <p className="micro-copy">Deterministischer Vorwärts-State-Lattice-Planer · vollständiger Fahrzeugumriss</p>
        </section>

        <section className="panel-section results-section">
          <div className="section-title"><span className="step">05</span><h2>Konfliktanalyse</h2></div>
          <div className="result-card"><div className="result-title"><i className="result-dot base-dot" /><strong>Bestand</strong><span>{baseResult?.status === 'success' ? 'Berechnet' : baseResult?.status === 'invalid_input' ? 'Eingabe prüfen' : baseResult?.status ?? 'Offen'}</span></div>
            {baseResult?.status === 'success' ? <Metrics result={baseResult} /> : <p>{baseResult?.warnings[0] ?? 'Noch keine Simulation berechnet.'}</p>}
          </div>
          <div className="result-card variant-card"><div className="result-title"><i className="result-dot variant-dot" /><strong>{variant?.name ?? 'Variante'}</strong><span>{variantResult?.status === 'success' ? 'Berechnet' : variantResult?.status ?? 'Offen'}</span></div>
            {variantResult?.status === 'success' ? <Metrics result={variantResult} /> : <p>{variantResult?.warnings[0] ?? 'Noch keine Simulation berechnet.'}</p>}
          </div>
          {baseResult?.status === 'success' && variantResult?.status === 'success' && <div className="comparison-note">Weglängenänderung <strong>{(variantResult.lengthM! - baseResult.lengthM!).toFixed(1)} m</strong> · unter den Modellannahmen; keine reale Fahrerverhaltensprognose.</div>}
        </section>

        <section className="panel-section playback-section"><div className="section-title"><span className="step">06</span><h2>Fahrzeug-Playback</h2></div>
          <div className="playback-controls"><button className="play-button" aria-label={isPlaying ? 'Pause' : 'Abspielen'} disabled={!pathCount} onClick={() => setIsPlaying((playing) => !playing)}>{isPlaying ? 'Ⅱ' : '▶'}</button><input aria-label="Fortschritt" type="range" min="0" max="1000" value={Math.round(playback * 1000)} disabled={!pathCount} onChange={(event) => useStreetLab.getState().setPlayback(Number(event.target.value) / 1000)} /><span>{Math.round(playback * 100)}%</span></div>
          <small>Fortschritt entlang der berechneten Route – keine reale Zeit.</small>
        </section>

        <section className="panel-section status-section"><div className="section-title"><span className="status-indicator" /><h2>Status</h2></div><p role="status">{status}</p></section>
      </aside>
    </section>
    <footer className="app-notice"><span>ⓘ</span><strong>Experimentelles Werkzeug – keine amtliche Verkehrsplanung.</strong><span>Modellierte Geometrie ≠ reale Sicherheit · Kartendaten werden beim Anbieter angefragt.</span></footer>
  </main>;
}

function Metrics({ result }: { result: SimulationResult }) {
  return <div className="metrics-grid"><div><span>Weglänge</span><strong>{result.lengthM?.toFixed(1)} <small>m</small></strong></div><div><span>Gehwegkontakt</span><strong className={result.sidewalkTouched ? 'warning-text' : ''}>{result.sidewalkTouched ? 'Ja' : 'Nein'}</strong></div><div><span>Gehwegfläche*</span><strong>{result.sidewalkOverlapAreaM2?.toFixed(2)} <small>m²</small></strong></div><div><span>Abstand harte Hindernisse</span><strong>{Number.isFinite(result.minObstacleClearanceM) ? `${result.minObstacleClearanceM?.toFixed(2)} m` : '–'}</strong></div><div className="collision-status"><span>Kollisionsstatus</span><strong>{result.hardCollision ? 'Kollision' : 'Unter Modellannahmen kollisionsfrei'}</strong></div>
    {result.warnings.length > 0 && <p className="metric-warning">{result.warnings.join(' ')}</p>}<small className="metric-footnote">* Maximale Überlappungsfläche einer geprüften Pose; Gehwegkontakt ist kein Unfallindikator.</small></div>;
}
