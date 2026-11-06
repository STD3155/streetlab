import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polygon, Polyline, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStreetLab } from '../app/store';
import { projectDiameterM, toLocal, toWgs84 } from '../domain/projection';
import type { SurfaceFeature } from '../domain/types';
import { getVehicleFootprint } from '../simulation/vehicle';
import 'leaflet/dist/leaflet.css';

const colors: Record<SurfaceFeature['kind'], string> = { road: '#485b6c', sidewalk: '#c9d4db', building: '#b84b4b', hard_obstacle: '#f08c31', curb: '#9063a8' };
const iconFor = (headingRad: number, label: string, color: string) => L.divIcon({
  className: 'pose-marker', html: `<div style="transform:rotate(${-headingRad * 180 / Math.PI}deg);color:${color}">➤</div><span>${label}</span>`,
  iconSize: [42, 30], iconAnchor: [20, 15],
});
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
  const maneuver = project.maneuvers[0];

  useMapEvents({ click(event) {
    const point = toLocal({ lon: event.latlng.lng, lat: event.latlng.lat }, project.centerWgs84);
    if (['road', 'sidewalk', 'building', 'hard_obstacle', 'island', 'sidewalk_protection'].includes(tool)) addPoint(point);
    else if (tool === 'poller') {
      if (Math.hypot(point.x, point.y) > 250) { setStatus('Poller liegt außerhalb des maximal 500 m großen Projektbereichs.'); return; }
      const radius = useStreetLab.getState().pollerDiameterM / 2;
      const ring = Array.from({ length: 17 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2;
        return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
      });
      useStreetLab.getState().addFeature({ id: crypto.randomUUID(), kind: 'hard_obstacle', geometry: [ring], properties: { name: 'Poller', diameterM: radius * 2, source: 'Nutzereingabe' } }, true);
    }
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
    else if (tool === 'start' || tool === 'goal') {
      if (!maneuver) return;
      if (Math.hypot(point.x, point.y) > 250) { setStatus('Pose liegt außerhalb des maximal 500 m großen Projektbereichs.'); return; }
      const next = structuredClone(project);
      if (tool === 'start') next.maneuvers[0]!.start = { ...point, headingRad: next.maneuvers[0]!.start.headingRad };
      else next.maneuvers[0]!.goal = { ...point, headingRad: next.maneuvers[0]!.goal.headingRad };
      setProject(next);
    }
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
  const rings = useMemo(() => feature.geometry.map((ring) => toLatLng(ring, project.centerWgs84)), [feature.geometry, project.centerWgs84]);
  return <Polygon positions={rings} pathOptions={{ color: selected ? '#f6c344' : colorOverride ?? colors[feature.kind], fillColor: colorOverride ?? colors[feature.kind], fillOpacity: feature.kind === 'road' ? 0.53 : 0.58, weight: selected ? 4 : 2 }} eventHandlers={{ click: () => onSelect() }} />;
}

export function StreetMap() {
  const project = useStreetLab((state) => state.project);
  const selectFeature = useStreetLab((state) => state.selectFeature);
  const selectedFeatureId = useStreetLab((state) => state.selectedFeatureId);
  const showBase = useStreetLab((state) => state.showBase);
  const showVariant = useStreetLab((state) => state.showVariant);
  const visibleKinds = useStreetLab((state) => state.visibleKinds);
  const results = useStreetLab((state) => state.results);
  const playback = useStreetLab((state) => state.playback);
  const maneuver = project.maneuvers[0];
  const variant = project.scenarios.find((scenario) => scenario.id === useStreetLab.getState().scenarioId);
  const baseResult = results['base'];
  const variantResult = variant ? results[variant.id] : undefined;
  const vehicle = project.vehicleSpecs.find((spec) => spec.id === maneuver?.vehicleId);
  const playbackPath = variantResult?.status === 'success' ? variantResult.path : baseResult?.status === 'success' ? baseResult.path : [];
  const playbackPose = playbackPath.length ? playbackPath[Math.min(playbackPath.length - 1, Math.round(playback * (playbackPath.length - 1)))] : null;
  const baseTile = import.meta.env.VITE_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const center = [project.centerWgs84.lat, project.centerWgs84.lon] as [number, number];

  return <MapContainer center={center} zoom={18} className="street-map" scrollWheelZoom preferCanvas>
    <MapViewport />
    <TileLayer url={baseTile} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>' />
    <ScaleControl position="bottomleft" imperial={false} />
    <MapInteractions />
    {showBase && project.baseFeatures.filter((feature) => visibleKinds[feature.kind]).map((feature) => <FeatureLayer key={feature.id} feature={feature} selected={selectedFeatureId === feature.id} onSelect={() => selectFeature(feature.id)} />)}
    {showVariant && variant?.additions.filter((feature) => visibleKinds[feature.kind]).map((feature) => <FeatureLayer key={feature.id} feature={feature} selected={selectedFeatureId === feature.id} colorOverride="#d97706" onSelect={() => selectFeature(feature.id)} />)}
    {maneuver && <>
      <Marker position={toLatLng([maneuver.start], project.centerWgs84)[0]!} icon={iconFor(maneuver.start.headingRad, 'Start', '#087f5b')} interactive={false} />
      <Marker position={toLatLng([maneuver.goal], project.centerWgs84)[0]!} icon={iconFor(maneuver.goal.headingRad, 'Ziel', '#1864ab')} interactive={false} />
    </>}
    {baseResult?.status === 'success' && showBase && <>
      {baseResult.sweptArea?.map((polygon, index) => <Polygon key={`base-swept-${index}`} positions={polygon.map((ring) => toLatLng(ring, project.centerWgs84))} pathOptions={{ color: '#228be6', fillColor: '#74c0fc', fillOpacity: 0.23, weight: 1 }} />)}
      <Polyline positions={toLatLng(baseResult.path, project.centerWgs84)} pathOptions={{ color: '#1864ab', weight: 4, dashArray: '8 5' }} />
    </>}
    {variantResult?.status === 'success' && showVariant && <>
      {variantResult.sweptArea?.map((polygon, index) => <Polygon key={`variant-swept-${index}`} positions={polygon.map((ring) => toLatLng(ring, project.centerWgs84))} pathOptions={{ color: '#e8590c', fillColor: '#ffc078', fillOpacity: 0.24, weight: 1 }} />)}
      <Polyline positions={toLatLng(variantResult.path, project.centerWgs84)} pathOptions={{ color: '#d9480f', weight: 4 }} />
    </>}
    {playbackPose && vehicle && <Polygon positions={getVehicleFootprint(playbackPose, vehicle).map((ring) => toLatLng(ring, project.centerWgs84))} pathOptions={{ color: '#111827', fillColor: '#facc15', fillOpacity: 0.75, weight: 2 }} />}
  </MapContainer>;
}
