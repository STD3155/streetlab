import { useEffect, useMemo } from 'react';
import { MapContainer, Polygon, Polyline, Rectangle, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useStreetLab } from '../app/store';
import { projectDiameterM, toLocal, toWgs84 } from '../domain/projection';
import type { SurfaceFeature } from '../domain/types';
import { resolveScenario } from '../domain/scenarios';
import 'leaflet/dist/leaflet.css';

const colors: Record<SurfaceFeature['kind'], string> = { street_space: '#219c9a', road: '#485b6c', sidewalk: '#c9d4db', building: '#b84b4b', hard_obstacle: '#f08c31', curb: '#9063a8' };
const toLatLng = (points: { x: number; y: number }[], center: { lon: number; lat: number }) => points.map((point) => {
  const wgs = toWgs84(point, center); return [wgs.lat, wgs.lon] as [number, number];
});

function MapInteractions() {
  const tool = useStreetLab((state) => state.tool);
  const addPoint = useStreetLab((state) => state.addPoint);
  const setProject = useStreetLab((state) => state.updateProject);
  const pendingPoints = useStreetLab((state) => state.pendingPoints);
  const selectedFeatureId = useStreetLab((state) => state.selectedFeatureId);
  const translateFeature = useStreetLab((state) => state.translateFeatureTo);
  const project = useStreetLab((state) => state.project);
  const setStatus = useStreetLab((state) => state.setStatus);

  useMapEvents({ click(event) {
    const point = toLocal({ lon: event.latlng.lng, lat: event.latlng.lat }, project.centerWgs84);
    if (['road', 'sidewalk', 'building', 'hard_obstacle', 'curb'].includes(tool)) addPoint(point);
    else if (tool === 'area') {
      if (pendingPoints.length === 0) addPoint(point);
      else {
        const a = toWgs84(pendingPoints[0]!, project.centerWgs84);
        const west = Math.min(a.lon, event.latlng.lng); const east = Math.max(a.lon, event.latlng.lng);
        const south = Math.min(a.lat, event.latlng.lat); const north = Math.max(a.lat, event.latlng.lat);
        const bounds: [number, number, number, number] = [west, south, east, north];
        const diameter = projectDiameterM(bounds, project.centerWgs84);
        if (diameter > 500) setStatus(`Projektbereich zu groß (${diameter.toFixed(0)} m). Erlaubt sind höchstens 500 m.`);
        else if ([pendingPoints[0]!, point].some((corner) => Math.hypot(corner.x, corner.y) > 250)) setStatus('Projektbereich liegt außerhalb des lokalen 500-m-Projektkreises. Bitte zuerst die Koordinaten als Projektzentrum festlegen.');
        else if (diameter < 2) setStatus('Projektbereich ist zu klein. Bitte ein größeres Rechteck aufziehen.');
        else { const next = structuredClone(project); next.boundsWgs84 = bounds; setProject(next); setStatus(`Projektbereich übernommen (${diameter.toFixed(1)} m Durchmesser).`); }
        useStreetLab.getState().clearPending(); useStreetLab.getState().setTool('select');
      }
    }
    else if (tool === 'measure') {
      if (pendingPoints.length === 0) addPoint(point);
      else { setStatus(`Gemessener Abstand: ${Math.hypot(point.x - pendingPoints[0]!.x, point.y - pendingPoints[0]!.y).toFixed(2)} m.`); useStreetLab.getState().setTool('select'); }
    }
    else if (tool === 'move' && selectedFeatureId) translateFeature(selectedFeatureId, point.x, point.y);
    else if (tool === 'move_vertex' && selectedFeatureId) useStreetLab.getState().moveVertexTo(selectedFeatureId, point.x, point.y);

  } });
  return pendingPoints.length > 0 ? <Polyline positions={toLatLng(pendingPoints, project.centerWgs84)} pathOptions={{ color: '#14b8a6', dashArray: '5 7', weight: 3 }} /> : null;
}

function MapViewport() {
  const map = useMap();
  const bounds = useStreetLab((state) => state.project.boundsWgs84);
  useEffect(() => { map.fitBounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]], { padding: [24, 24] }); }, [map, bounds]);
  return null;
}

function FeatureLayer({ feature, selected, onSelect, colorOverride }: { feature: SurfaceFeature; selected: boolean; onSelect: () => void; colorOverride?: string }) {
  const project = useStreetLab((state) => state.project);
  const tool = useStreetLab((state) => state.tool);
  const selecting = ['select', 'move', 'move_vertex'].includes(tool);
  const rings = useMemo(() => feature.geometry.map((ring) => toLatLng(ring, project.centerWgs84)), [feature.geometry, project.centerWgs84]);
  return <Polygon bubblingMouseEvents={!selecting || selected} positions={rings} pathOptions={{ color: selected ? '#f6c344' : colorOverride ?? colors[feature.kind], fillColor: colorOverride ?? colors[feature.kind], fillOpacity: feature.kind === 'road' ? 0.53 : 0.58, weight: selected ? 4 : 2 }} eventHandlers={{ click: () => { if (selecting) onSelect(); } }} />;
}

export function StreetMap() {
  const project = useStreetLab((state) => state.project);
  const selectFeature = useStreetLab((state) => state.selectFeature);
  const selectedFeatureId = useStreetLab((state) => state.selectedFeatureId);
  const visibleKinds = useStreetLab((state) => state.visibleKinds);
  const scenarioId = useStreetLab((state) => state.scenarioId);
  const editTarget = useStreetLab((state) => state.editTarget);
  const features = editTarget === 'scenario' ? resolveScenario(project, scenarioId) : project.baseFeatures;
  const baseIds = new Set(project.baseFeatures.map((feature) => feature.id));
  const baseTile = import.meta.env.VITE_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const center = [project.centerWgs84.lat, project.centerWgs84.lon] as [number, number];

  return <MapContainer center={center} zoom={18} className="street-map" scrollWheelZoom preferCanvas>
    <MapViewport />
    <TileLayer url={baseTile} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>' />
    <ScaleControl position="bottomleft" imperial={false} />
    <MapInteractions />
    <Rectangle bounds={[[project.boundsWgs84[1], project.boundsWgs84[0]], [project.boundsWgs84[3], project.boundsWgs84[2]]]} pathOptions={{ color: '#176963', fill: false, dashArray: '6 6', weight: 2 }} interactive={false} />
    {features.filter((feature) => visibleKinds[feature.kind]).map((feature) => <FeatureLayer key={feature.id} feature={feature} selected={selectedFeatureId === feature.id} colorOverride={baseIds.has(feature.id) ? undefined : '#d97706'} onSelect={() => selectFeature(feature.id)} />)}
  </MapContainer>;
}
