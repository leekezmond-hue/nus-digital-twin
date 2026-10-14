'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ActiveBus, CampusBuilding, CameraTarget } from '@/lib/types';
import { ThreeBusLayer } from '@/lib/threeBusLayer';

interface MapCanvasProps {
  buildingsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null;
  energyPillarsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null;
  stopsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  routesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
  activeBuses: ActiveBus[];
  buildings: CampusBuilding[];
  flyToTarget: CameraTarget | null;
  onSelectBuilding: (building: CampusBuilding | null) => void;
  onSelectBus?: (bus: ActiveBus | null) => void;
}

const KENT_RIDGE_CENTER: [number, number] = [103.7745, 1.2970];
const CAMPUS_BOUNDS: [number, number, number, number] = [103.7600, 1.2850, 103.7900, 1.3150];

export default function MapCanvas({
  buildingsGeoJson,
  energyPillarsGeoJson,
  stopsGeoJson,
  routesGeoJson,
  activeBuses,
  buildings,
  flyToTarget,
  onSelectBuilding,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const threeLayerRef = useRef<ThreeBusLayer | null>(null);

  // Data cache refs to avoid race conditions during map load
  const buildingsGeoJsonRef = useRef(buildingsGeoJson);
  const energyPillarsGeoJsonRef = useRef(energyPillarsGeoJson);
  const stopsGeoJsonRef = useRef(stopsGeoJson);
  const routesGeoJsonRef = useRef(routesGeoJson);
  const activeBusesRef = useRef(activeBuses);
  const buildingsRef = useRef(buildings);

  buildingsGeoJsonRef.current = buildingsGeoJson;
  energyPillarsGeoJsonRef.current = energyPillarsGeoJson;
  stopsGeoJsonRef.current = stopsGeoJson;
  routesGeoJsonRef.current = routesGeoJson;
  activeBusesRef.current = activeBuses;
  buildingsRef.current = buildings;

  // Synchronizes dynamic layers once style is loaded
  const syncDynamicLayers = useCallback((map: MapLibreMap) => {
    if (!map.isStyleLoaded()) return;

    // 1. Campus Route Polylines
    const routeData = routesGeoJsonRef.current || { type: 'FeatureCollection', features: [] };
    if (!map.getSource('campus-routes')) {
      map.addSource('campus-routes', {
        type: 'geojson',
        data: routeData,
      });
      map.addLayer({
        id: 'campus-routes-glow',
        type: 'line',
        source: 'campus-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#94A3B8'],
          'line-width': 7,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      });
      map.addLayer({
        id: 'campus-routes-line',
        type: 'line',
        source: 'campus-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#94A3B8'],
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });
    } else {
      (map.getSource('campus-routes') as maplibregl.GeoJSONSource).setData(routeData);
    }

    // 2. Campus Shuttle Stops
    const stopData = stopsGeoJsonRef.current || { type: 'FeatureCollection', features: [] };
    if (!map.getSource('campus-stops')) {
      map.addSource('campus-stops', {
        type: 'geojson',
        data: stopData,
      });
      map.addLayer({
        id: 'campus-stops-outer',
        type: 'circle',
        source: 'campus-stops',
        paint: {
          'circle-radius': 6,
          'circle-color': '#0ea5e9',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'campus-stops-label',
        type: 'symbol',
        source: 'campus-stops',
        layout: {
          'text-field': ['get', 'caption'],
          'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#020617',
          'text-halo-width': 1.5,
        },
      });
    } else {
      (map.getSource('campus-stops') as maplibregl.GeoJSONSource).setData(stopData);
    }

    // 3. 3D Building Extrusions
    const buildingData = buildingsGeoJsonRef.current || { type: 'FeatureCollection', features: [] };
    if (!map.getSource('campus-buildings')) {
      map.addSource('campus-buildings', {
        type: 'geojson',
        data: buildingData,
      });
      map.addLayer({
        id: 'campus-3d-buildings',
        type: 'fill-extrusion',
        source: 'campus-buildings',
        paint: {
          'fill-extrusion-color': [
            'match',
            ['get', 'category'],
            'academic', '#38bdf8',
            'residential', '#c084fc',
            'recreation', '#34d399',
            'admin', '#fbbf24',
            '#94a3b8',
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82,
        },
      });
    } else {
      (map.getSource('campus-buildings') as maplibregl.GeoJSONSource).setData(buildingData);
    }

    // 4. 3D Energy Pillars rising from rooftops
    const pillarData = energyPillarsGeoJsonRef.current || { type: 'FeatureCollection', features: [] };
    if (!map.getSource('campus-energy-pillars')) {
      map.addSource('campus-energy-pillars', {
        type: 'geojson',
        data: pillarData,
      });
      map.addLayer({
        id: 'campus-energy-pillars',
        type: 'fill-extrusion',
        source: 'campus-energy-pillars',
        paint: {
          'fill-extrusion-color': [
            'step',
            ['get', 'eui'],
            '#06b6d4', // <160: Deep Cyan (Efficient)
            160,
            '#3b82f6', // 160-200: Hyper Cobalt (Moderate)
            200,
            '#a855f7', // >200: Neon Purple (Intensive)
          ],
          'fill-extrusion-base': ['get', 'height'],
          'fill-extrusion-height': ['get', 'pillarHeight'],
          'fill-extrusion-opacity': 0.94,
        },
      });
    } else {
      (map.getSource('campus-energy-pillars') as maplibregl.GeoJSONSource).setData(pillarData);
    }

    // 5. Register ThreeBusLayer after routes
    if (!threeLayerRef.current) {
      const busLayer = new ThreeBusLayer();
      threeLayerRef.current = busLayer;
      if (!map.getLayer(busLayer.id)) {
        map.addLayer(busLayer);
      }
      busLayer.updateBuses(activeBusesRef.current);
    }
  }, []);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (typeof window !== 'undefined') {
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: KENT_RIDGE_CENTER,
      zoom: 16.2,
      pitch: 60,
      bearing: -20,
      maxBounds: CAMPUS_BOUNDS,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15,
      className: 'campus-map-popup',
    });

    map.on('load', () => {
      syncDynamicLayers(map);
    });

    map.on('styledata', () => {
      syncDynamicLayers(map);
    });

    // Hover tooltip for 3D buildings & pillars
    const handleBuildingHover = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        const props = feature.properties;
        const eui = Number(props.eui || 0).toFixed(1);
        const name = props.name || 'Campus Building';
        const category = props.category || 'Academic';

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-3 text-xs font-mono bg-[#0d1117]/95 text-slate-100 rounded-lg border border-white/10 shadow-2xl backdrop-blur-md">
              <div class="flex items-center justify-between gap-3 text-[10px] text-slate-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-1.5">
                <span>TWIN // BLD</span>
                <span class="text-cyan-400 capitalize">${category}</span>
              </div>
              <div class="font-bold text-white text-sm tracking-tight font-sans">${name}</div>
              <div class="mt-2 flex items-center justify-between gap-4 text-xs bg-black/40 px-2 py-1 rounded border border-white/5">
                <span class="text-slate-400">ANNUAL EUI</span>
                <span class="font-mono font-bold text-cyan-400">${eui} <span class="text-[10px] text-slate-500">kWh/m²</span></span>
              </div>
            </div>`
          )
          .addTo(map);
      }
    };

    const handleBuildingLeave = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    };

    map.on('mousemove', 'campus-3d-buildings', handleBuildingHover);
    map.on('mouseleave', 'campus-3d-buildings', handleBuildingLeave);
    map.on('mousemove', 'campus-energy-pillars', handleBuildingHover);
    map.on('mouseleave', 'campus-energy-pillars', handleBuildingLeave);

    // Click to select building
    const handleBuildingClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const elementId = feature.properties.elementId;
        const found = buildingsRef.current.find((b) => b.elementId === elementId);
        if (found) {
          onSelectBuilding(found);
        }
      }
    };

    map.on('click', 'campus-3d-buildings', handleBuildingClick);
    map.on('click', 'campus-energy-pillars', handleBuildingClick);

    // Stop popup on click
    map.on('click', 'campus-stops-outer', (e) => {
      if (e.features && e.features.length > 0) {
        const f = e.features[0];
        const caption = f.properties.caption || f.properties.name;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-2 text-xs font-sans bg-slate-900 text-white rounded border border-sky-500">
              <div class="font-bold text-sky-400">${caption}</div>
              <div class="text-slate-400">NUS Shuttle Stop</div>
            </div>`
          )
          .addTo(map);
      }
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      threeLayerRef.current = null;
    };
  }, [syncDynamicLayers, onSelectBuilding]);

  // Update dynamic GeoJSON data when props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (buildingsGeoJson && map.getSource('campus-buildings')) {
      (map.getSource('campus-buildings') as maplibregl.GeoJSONSource).setData(buildingsGeoJson);
    }
    if (energyPillarsGeoJson && map.getSource('campus-energy-pillars')) {
      (map.getSource('campus-energy-pillars') as maplibregl.GeoJSONSource).setData(energyPillarsGeoJson);
    }
    if (stopsGeoJson && map.getSource('campus-stops')) {
      (map.getSource('campus-stops') as maplibregl.GeoJSONSource).setData(stopsGeoJson);
    }
    if (routesGeoJson && map.getSource('campus-routes')) {
      (map.getSource('campus-routes') as maplibregl.GeoJSONSource).setData(routesGeoJson);
    }
  }, [buildingsGeoJson, energyPillarsGeoJson, stopsGeoJson, routesGeoJson]);

  // Update 3D bus telemetry layer
  useEffect(() => {
    if (threeLayerRef.current) {
      threeLayerRef.current.updateBuses(activeBuses);
    }
  }, [activeBuses]);

  // Handle camera fly-to animations
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;

    map.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      pitch: flyToTarget.pitch ?? 65,
      bearing: flyToTarget.bearing ?? -25,
      zoom: flyToTarget.zoom ?? 17.2,
      duration: 1400,
      essential: true,
    });
  }, [flyToTarget]);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={containerRef} className="w-full h-full absolute inset-0" />
    </div>
  );
}
