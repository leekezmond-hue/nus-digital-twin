'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { CampusBuilding, TransitState, CameraTarget } from '@/lib/types';
import BusTracker from '@/components/BusTracker';
import CampusEnergyChart from '@/components/CampusEnergyChart';
import BuildingEnergyModal from '@/components/BuildingEnergyModal';
import { Compass, Radio, RefreshCw, Activity, Terminal, Shield } from 'lucide-react';

// Client-only dynamic import of MapCanvas (Zero-SSR rule)
const MapCanvas = dynamic(() => import('@/components/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#090D14] text-slate-400 gap-3 font-mono">
      <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs tracking-widest uppercase text-slate-400">
        INITIALIZING // MAPLIBRE 3D ARCHITECTURAL TWIN
      </span>
    </div>
  ),
});

// Iconic campus navigation presets (Snappy Tactical Profile)
const CAMPUS_PRESETS: Array<{ id: string; name: string; target: CameraTarget }> = [
  {
    id: '01',
    name: 'Overview',
    target: { lng: 103.7745, lat: 1.2970, pitch: 60, bearing: -20, zoom: 16.2 },
  },
  {
    id: '02',
    name: 'UTown',
    target: { lng: 103.7738, lat: 1.3040, pitch: 65, bearing: 45, zoom: 16.6 },
  },
  {
    id: '03',
    name: 'COM3',
    target: { lng: 103.7745, lat: 1.2944, pitch: 65, bearing: -30, zoom: 17.2 },
  },
  {
    id: '04',
    name: 'CLB',
    target: { lng: 103.7725, lat: 1.2966, pitch: 55, bearing: 10, zoom: 16.8 },
  },
  {
    id: '05',
    name: 'KR-MRT',
    target: { lng: 103.7844, lat: 1.2932, pitch: 60, bearing: -60, zoom: 16.8 },
  },
];

export default function CampusDashboardPage() {
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [buildingsGeoJson, setBuildingsGeoJson] = useState<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null>(null);
  const [energyPillarsGeoJson, setEnergyPillarsGeoJson] = useState<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null>(null);

  const [stopsGeoJson, setStopsGeoJson] = useState<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const [routesGeoJson, setRoutesGeoJson] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null);

  const [transitState, setTransitState] = useState<TransitState>({
    asOf: '',
    stale: false,
    estimated: true,
    buses: [],
    isOffService: false,
  });

  const [pollCountdown, setPollCountdown] = useState<number>(5);
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<CameraTarget | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  // SGT Clock updater (1s interval)
  useEffect(() => {
    function updateClock() {
      try {
        const now = new Date();
        const sgt = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Singapore',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
        setCurrentTime(`${sgt} SGT`);
      } catch {
        setCurrentTime('SGT // ACTIVE');
      }
    }
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 1. Fetch buildings & energy data on client mount
  useEffect(() => {
    async function loadBuildings() {
      try {
        const res = await fetch('/api/buildings');
        if (res.ok) {
          const data = await res.json();
          setBuildings(data.buildings || []);
          setBuildingsGeoJson(data.buildingsGeoJson || null);
          setEnergyPillarsGeoJson(data.energyPillarsGeoJson || null);
        }
      } catch (err) {
        console.error('Failed to load buildings on client:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadBuildings();
  }, []);

  // 2. Fetch transit stops and route geometries on mount
  useEffect(() => {
    async function loadTransitTopology() {
      try {
        const res = await fetch('/api/transit/stops');
        if (res.ok) {
          const data = await res.json();
          setStopsGeoJson(data.stopsGeoJson || null);
          setRoutesGeoJson(data.routesGeoJson || null);
        }
      } catch (err) {
        console.error('Failed to load transit stops and routes:', err);
      }
    }

    loadTransitTopology();
  }, []);

  // 3. Telemetry polling loop: every 5 seconds with countdown timer
  const fetchBusesRef = useRef<() => Promise<void>>(async () => {});
  fetchBusesRef.current = async () => {
    try {
      const res = await fetch('/api/transit/buses');
      if (res.ok) {
        const data: TransitState = await res.json();
        setTransitState(data);
      }
    } catch (err) {
      console.warn('Bus telemetry poll error:', err);
    }
  };

  useEffect(() => {
    fetchBusesRef.current();

    let secondsLeft = 5;
    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        fetchBusesRef.current();
        secondsLeft = 5;
      }
      setPollCountdown(secondsLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090D14] flex flex-col font-sans select-none">
      {/* Mission Control Bento Header */}
      <header className="absolute top-0 left-0 right-0 z-20 h-14 bg-[#0D1117]/92 backdrop-blur-md border-b border-white/[0.08] px-4 flex items-center justify-between pointer-events-auto">
        {/* Left: Tactical Brand Tag & Coordinates */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-widest text-slate-100">
              NUS // TWIN-OPS
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>1.2970° N, 103.7745° E</span>
          </div>
        </div>

        {/* Center: Tactile Landmark Presets */}
        <div className="hidden md:flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-white/[0.08]">
          {CAMPUS_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => setFlyToTarget(p.target)}
              className="px-2.5 py-1 rounded text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors font-mono text-[11px] flex items-center gap-1.5"
            >
              <span className="text-[9px] text-slate-500 font-bold">{p.id}</span>
              <span className="font-sans font-medium">{p.name}</span>
            </button>
          ))}
        </div>

        {/* Right: Live Ticker Strip */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] bg-black/50 px-2.5 py-1 rounded border border-white/[0.08] text-slate-300">
            <span className="text-cyan-400">{currentTime || '12:00:00 SGT'}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] bg-black/50 px-2.5 py-1 rounded border border-white/[0.08] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{transitState.buses.length} FLEET UNITS</span>
          </div>

          <button
            onClick={() => {
              setPollCountdown(5);
              fetchBusesRef.current();
            }}
            className="p-1.5 rounded bg-black/50 hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Force refresh live transit feed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main 3D WebGL Canvas */}
      <div className="w-full h-full pt-14 relative">
        <MapCanvas
          buildingsGeoJson={buildingsGeoJson}
          energyPillarsGeoJson={energyPillarsGeoJson}
          stopsGeoJson={stopsGeoJson}
          routesGeoJson={routesGeoJson}
          activeBuses={transitState.buses}
          buildings={buildings}
          flyToTarget={flyToTarget}
          onSelectBuilding={setSelectedBuilding}
        />

        {/* Live Military Transponder Shuttle HUD */}
        <BusTracker
          transitState={transitState}
          pollSecondsRemaining={pollCountdown}
          onFocusTarget={setFlyToTarget}
        />

        {/* Bento Energy Telemetry Leaderboard */}
        <CampusEnergyChart
          buildings={buildings}
          onSelectBuilding={setSelectedBuilding}
          onFocusTarget={setFlyToTarget}
        />

        {/* Architectural Building Inspector Modal */}
        <BuildingEnergyModal
          building={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          onFocusTarget={setFlyToTarget}
        />
      </div>

      {/* Initial Loading Screen */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-[#090D14]/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 font-mono">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-bold text-slate-100 tracking-widest uppercase">
            SYNTHESIZING // NUS DIGITAL TWIN &amp; TELEMETRY
          </div>
          <div className="text-[11px] text-slate-400">
            INGESTING 264 BUILDINGS &amp; LIVE GCP RUN PROXY
          </div>
        </div>
      )}
    </main>
  );
}
