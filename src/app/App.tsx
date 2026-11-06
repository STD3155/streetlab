import { useRef, useState } from 'react';
import { closeRing, isValidPolygon } from '../domain/geometry';
import { createProject } from '../domain/project';
import { resolveScenario } from '../domain/scenarios';
import type { FeatureKind, SurfaceFeature } from '../domain/types';
import { exportGeoJson, exportProject, importProject } from '../persistence/projectIO';
import { StreetMap } from '../map/StreetMap';
import { fetchAlkis } from '../map/dataSources';
import { useStreetLab, type ToolMode } from './store';

const featureLabels: Record<FeatureKind, string> = { street_space: 'ALKIS-Straßenraum', road: 'Fahrbahn', sidewalk: 'Gehweg', building: 'Gebäude', hard_obstacle: 'Hindernis', curb: 'Bordkante' };
const toolOptions: { mode: ToolMode; label: string }[] = [
  { mode: 'area', label: 'Bereich festlegen' }, { mode: 'measure', label: 'Abstand messen' },
  { mode: 'road', label: 'Fahrbahn' }, { mode: 'sidewalk', label: 'Gehweg' },
  { mode: 'building', label: 'Gebäude' }, { mode: 'hard_obstacle', label: 'Hindernis' },
  { mode: 'curb', label: 'Bordkante' }, { mode: 'move', label: 'Fläche verschieben' },
  { mode: 'move_vertex', label: 'Stützpunkt bearbeiten' },
];
const drawingTools: ToolMode[] = ['road', 'sidewalk', 'building', 'hard_obstacle', 'curb'];

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const state = useStreetLab();
  const { project, tool, editTarget, pendingPoints, selectedFeatureId, status, scenarioId, visibleKinds } = state;
  const [coords, setCoords] = useState(`${project.centerWgs84.lat}, ${project.centerWgs84.lon}`);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeImport = useRef<AbortController | null>(null);
  const variant = project.scenarios.find((scenario) => scenario.id === scenarioId);
  const features = editTarget === 'base' ? project.baseFeatures : resolveScenario(project, scenarioId);
  const selected = features.find((feature) => feature.id === selectedFeatureId);

  function replaceProject(next: typeof project) {
    activeImport.current?.abort();
    state.setProject(next);
    setCoords(`${next.centerWgs84.lat}, ${next.centerWgs84.lon}`);
  }

  function goToCoordinates(event: React.FormEvent) {
    event.preventDefault();
    const parts = coords.split(',').map((part) => part.trim());
    const [lat, lon] = parts.map(Number);
    if (parts.length !== 2 || parts.some((part) => !part) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      state.setStatus('Koordinatenformat: Breitengrad, Längengrad (WGS84).'); return;
    }
    if (!project.baseFeatures.length || confirm('Neues Gebiet öffnen und aktuelle Geometrie ersetzen?')) replaceProject(createProject(lon, lat));
  }

  function finishPolygon() {
    if (!drawingTools.includes(tool)) return;
    const geometry = [closeRing(pendingPoints)];
    if (!isValidPolygon(geometry)) { state.setStatus('Ungültiges Polygon: mindestens drei Punkte ohne Selbstüberschneidung erforderlich.'); return; }
    if (pendingPoints.some((point) => Math.hypot(point.x, point.y) > 250)) { state.setStatus('Polygon liegt außerhalb des maximal 500 m großen Projektbereichs.'); return; }
    const kind = tool as SurfaceFeature['kind'];
    state.addFeature({ id: crypto.randomUUID(), kind, geometry, properties: { name: featureLabels[kind], source: 'Nutzereingabe' } });
  }

  async function importFile(file?: File) {
    if (!file) return;
    try { replaceProject(importProject(await file.text())); }
    catch (error) { state.setStatus(error instanceof Error ? `Import abgelehnt: ${error.message}` : 'Projektdatei konnte nicht importiert werden.'); }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function importAlkis() {
    const current = useStreetLab.getState().project;
    const controller = new AbortController();
    activeImport.current?.abort(); activeImport.current = controller;
    setImporting(true); state.setStatus('ALKIS-Flächengrundlage wird geladen …');
    try {
      const imported = await fetchAlkis(current.boundsWgs84, current.centerWgs84, controller.signal);
      if (controller.signal.aborted) return;
      if (useStreetLab.getState().project !== current) { state.setStatus('Projekt wurde zwischenzeitlich geändert. ALKIS bitte erneut laden.'); return; }
      if (!imported.features.length) throw new Error('Keine passenden ALKIS-Flächen im Projektbereich gefunden.');
      // Refresh reference layers while preserving all manually captured geometry and variants.
      const next = structuredClone(current);
      next.baseFeatures = [...current.baseFeatures.filter((feature) => !feature.properties?.reference), ...imported.features];
      next.geometrySource = `©GeoBasis-DE / LVermGeoRP ${new Date().getFullYear()}, dl-de/by-2-0; ALKIS-RLP [Daten bearbeitet]`;
      next.geometryAccuracyNote = imported.notes.join(' ');
      state.updateProject(next);
      state.setStatus(`ALKIS geladen: ${imported.counts.streetSpaces} Straßenraumflächen, ${imported.counts.buildings} Gebäude.${imported.counts.skipped ? ` ${imported.counts.skipped} Objekte ausgelassen.` : ''}`);
    } catch (error) {
      if (!controller.signal.aborted) state.setStatus(error instanceof Error ? `ALKIS-Import fehlgeschlagen: ${error.message}` : 'ALKIS-Import fehlgeschlagen.');
    } finally {
      if (activeImport.current === controller) { activeImport.current = null; setImporting(false); }
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">S</div><div><strong>StreetLab</strong><span>Straßenraum und Entwurfsgrundlage</span></div></div>
      <div className="project-title"><strong>{project.title}</strong><small>{project.geometrySource}</small></div>
      <div className="top-actions">
        <button className="icon-button" aria-label="Rückgängig" disabled={!state.past.length} onClick={state.undo}>↶</button>
        <button className="icon-button" aria-label="Wiederholen" disabled={!state.future.length} onClick={state.redo}>↷</button>
        <button className="button button-quiet" onClick={() => { if (confirm('Aktuelles Projekt durch ein leeres Projekt ersetzen?')) replaceProject(createProject(project.centerWgs84.lon, project.centerWgs84.lat)); }}>Neues Projekt</button>
        <button className="button button-quiet" onClick={() => { const title = prompt('Projektname', project.title)?.trim(); if (title) state.updateProject({ ...project, title }); }}>Umbenennen</button>
        <button className="button button-quiet" onClick={() => fileInput.current?.click()}>Import</button>
        <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
        <button className="button button-primary" onClick={() => download('streetlab-projekt.json', exportProject(project))}>Projekt exportieren</button>
        <button className="button button-quiet" onClick={() => download('streetlab-geometrie.geojson', exportGeoJson(project), 'application/geo+json')}>GeoJSON</button>
      </div>
    </header>
    <section className="workspace">
      <aside className="sidebar">
        <section className="panel-section">
          <h2>Projektbereich</h2>
          <form onSubmit={goToCoordinates} className="coordinate-form">
            <label htmlFor="coordinates">Koordinaten · WGS84 lat, lon</label>
            <div className="input-row"><input id="coordinates" value={coords} onChange={(event) => setCoords(event.target.value)} /><button className="small-button" type="submit" title="Neues Gebiet öffnen">↗</button></div>
          </form>
          <p className="micro-copy">Ein neues Gebiet beginnt leer. Bereich mit zwei gegenüberliegenden Ecken festlegen; maximal 500 m Durchmesser.</p>
          <button className="button alkis-button" onClick={() => void importAlkis()} disabled={importing}>{importing ? 'ALKIS wird geladen …' : 'ALKIS-Flächengrundlage laden'}</button>
          <p className="micro-copy">Rheinland-Pfalz · ©GeoBasis-DE / LVermGeoRP · dl-de/by-2-0. Straßenverkehrsflächen belegen weder Fahrbahnränder noch öffentliche Widmung.</p>
        </section>
        <section className="panel-section">
          <h2>Flächen bearbeiten</h2>
          <div className="tool-grid">{toolOptions.map((option) => <button key={option.mode} className={`tool-button ${tool === option.mode ? 'active' : ''}`} aria-pressed={tool === option.mode} onClick={() => state.setTool(tool === option.mode ? 'select' : option.mode)}>{option.label}</button>)}</div>
          {drawingTools.includes(tool) && <div className="draw-actions"><span>{pendingPoints.length} Stützpunkte</span><button className="small-button" onClick={finishPolygon} disabled={pendingPoints.length < 3}>Polygon abschließen</button><button className="text-button" onClick={state.clearPending}>Verwerfen</button></div>}
          {tool === 'area' && <p className="micro-copy">Zwei gegenüberliegende Ecken auf der Karte anklicken.</p>}
          {tool === 'move' && <p className="micro-copy">Fläche auswählen, dann auf den neuen Mittelpunkt klicken.</p>}
          {tool === 'move_vertex' && <p className="micro-copy">Fläche auswählen, dann höchstens 4 m neben den zu verschiebenden Eckpunkt klicken.</p>}
          {tool === 'measure' && <p className="micro-copy">Zwei Punkte auf der Karte anklicken.</p>}
          <div className="layer-list">
            {Object.entries(featureLabels).map(([kind, label]) => <label className="layer-row" key={kind}><input type="checkbox" checked={visibleKinds[kind as FeatureKind]} onChange={(event) => state.setKindVisibility(kind as FeatureKind, event.target.checked)} /><i className={`swatch ${kind}`} />{label}<small>{features.filter((feature) => feature.kind === kind).length}</small></label>)}
          </div>
          {selected && <div className="selected-feature"><span>{selected.properties?.name ?? featureLabels[selected.kind]}{selected.properties?.reference ? ' · Referenz' : ''}</span>{!selected.properties?.reference && <button className="text-button danger" onClick={() => state.removeFeature(selected.id)}>Entfernen</button>}</div>}
        </section>
        <section className="panel-section">
          <h2>Bestand und Varianten</h2>
          <div className="edit-toggle"><button className={editTarget === 'base' ? 'active' : ''} onClick={() => state.setEditTarget('base')}>Bestand</button><button className={editTarget === 'scenario' ? 'active' : ''} onClick={() => state.setEditTarget('scenario')}>Variante</button></div>
          <label className="field-label" htmlFor="scenario">Aktive Variante</label>
          <select id="scenario" value={scenarioId} onChange={(event) => useStreetLab.setState({ scenarioId: event.target.value, selectedFeatureId: null, pendingPoints: [] })}>{project.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select>
          <button className="text-button" onClick={state.newVariant}>＋ Neue Variante</button>
        </section>
        <section className="panel-section"><h2>Status</h2><p role="status">{status}</p></section>
      </aside>
      <section className="map-column">
        <div className="map-toolbar"><strong>{toolOptions.find((option) => option.mode === tool)?.label ?? 'Karte · Auswählen und verschieben'}</strong><span>{editTarget === 'base' ? 'Bestand' : variant?.name} · lokal metrisch</span></div>
        <div className="map-frame"><StreetMap /></div>
        <div className="map-footer"><span title={project.geometryAccuracyNote}>{project.geometryAccuracyNote}</span><span>500 m max.</span></div>
      </section>
    </section>
    <footer className="app-notice">Flächengrundlage und manueller Editor · Querschnittsgenerator und Regelprüfung sind noch nicht implementiert.</footer>
  </main>;
}
