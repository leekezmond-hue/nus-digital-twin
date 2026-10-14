'use client';

import React, { useState } from 'react';
import { ActiveBus, TransitState, CameraTarget } from '@/lib/types';
import { ROUTE_COLORS, DEFAULT_ROUTE_COLOR } from '@/lib/transit';
import { Bus, Clock, Gauge, Users, AlertTriangle, ChevronRight, Radio, Activity } from 'lucide-react';

interface BusTrackerProps {
  transitState: TransitState;
  pollSecondsRemaining: number;
  onFocusTarget: (target: CameraTarget) => void;
}

export default function BusTracker({
  transitState,
  pollSecondsRemaining,
  onFocusTarget,
}: BusTrackerProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const buses = transitState.buses || [];
  const uniqueRoutes = Array.from(new Set(buses.map((b) => b.route))).sort();

  const filteredBuses =
    selectedRoute === 'ALL'
      ? buses
      : buses.filter((b) => b.route === selectedRoute);

  return (
    <div className="absolute top-4 right-4 z-20 w-84 sm:w-96 max-h-[calc(100vh-2rem)] flex flex-col font-mono transition-all">
      {/* Header Panel */}
      <div className="bg-[#0D1117]/92 backdrop-blur-md border border-white/[0.08] rounded-t-xl p-3 shadow-2xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 tracking-wider uppercase">
                RADAR // DISPATCH
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{buses.length} ACTIVE TRANSPONDERS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 5s Poll Countdown Badge */}
            <div
              className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-white/[0.08]"
              title="Telemetry cycle countdown"
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{pollCountdownDisplay(pollSecondsRemaining)}</span>
            </div>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-black/40 hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
            >
              {isCollapsed ? 'EXPAND' : 'MIN'}
            </button>
          </div>
        </div>

        {/* Off-Service Standby Notice */}
        {transitState.isOffService && (
          <div className="bg-amber-950/20 border border-amber-500/30 rounded p-2 text-[10px] text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">STANDBY // 0700-2300 SGT</span>
              <span className="text-slate-400 font-sans">
                {transitState.message ||
                  'Shuttle service offline. Telemetry resumes at 07:00 SGT.'}
              </span>
            </div>
          </div>
        )}

        {/* Route Filter Badges */}
        {!isCollapsed && uniqueRoutes.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              onClick={() => setSelectedRoute('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                selectedRoute === 'ALL'
                  ? 'bg-orange-500 text-white border-orange-400 font-bold'
                  : 'bg-black/30 text-slate-400 border-white/5 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              ALL ({buses.length})
            </button>
            {uniqueRoutes.map((r) => {
              const color = ROUTE_COLORS[r] || DEFAULT_ROUTE_COLOR;
              const isSelected = selectedRoute === r;
              return (
                <button
                  key={r}
                  onClick={() => setSelectedRoute(r)}
                  style={{
                    borderColor: isSelected ? color : 'rgba(255,255,255,0.08)',
                    backgroundColor: isSelected ? `${color}30` : undefined,
                    color: isSelected ? '#ffffff' : color,
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all hover:bg-white/[0.05]"
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bus Cards List - Military Transponder Style */}
      {!isCollapsed && (
        <div className="bg-[#0D1117]/92 backdrop-blur-md border-x border-b border-white/[0.08] rounded-b-xl max-h-[60vh] overflow-y-auto divide-y divide-white/[0.04] p-1.5 shadow-2xl">
          {filteredBuses.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-500 font-mono">
              NO SIGNALS ON ACTIVE FREQUENCY
            </div>
          ) : (
            filteredBuses.map((bus) => {
              const routeColor = ROUTE_COLORS[bus.route] || DEFAULT_ROUTE_COLOR;
              const ridershipPct = Math.min(
                100,
                Math.round((bus.occupancy.ridership / (bus.occupancy.capacity || 88)) * 100)
              );

              return (
                <div
                  key={bus.id}
                  className="p-2.5 hover:bg-white/[0.04] rounded transition-all flex flex-col gap-1.5 group cursor-pointer"
                  onClick={() =>
                    onFocusTarget({
                      lng: bus.lng,
                      lat: bus.lat,
                      zoom: 17.5,
                      pitch: 65,
                      bearing: -bus.bearing,
                    })
                  }
                >
                  {/* Top Row: Callsign & Status */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: routeColor }}
                        className="px-1.5 py-0.2 rounded text-[10px] font-black text-white"
                      >
                        {bus.route}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-100">
                        {bus.plate}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                          bus.status === 'IN_SERVICE'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-black/40 text-slate-400 border border-white/5'
                        }`}
                      >
                        {bus.status === 'IN_SERVICE' ? 'ARMED' : 'TERMINAL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-cyan-400 text-[10px]">
                      <span>LOCK</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Telemetry Metrics: Error Bound & Speed */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded border border-white/5">
                    <span className="text-cyan-400 font-mono">
                      ±{bus.errorBoundM}M BOUND
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Gauge className="w-3 h-3 text-slate-400" />
                      {bus.speedKmh.toFixed(1)} KM/H
                    </span>
                  </div>

                  {/* Waypoint & ETA */}
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-sans">
                    <div className="flex items-center gap-1 truncate text-xs">
                      <span className="text-slate-500 font-mono text-[10px]">WAYPOINT:</span>
                      <span className="font-medium truncate text-slate-200">
                        {bus.anchorStop || bus.prevStop || 'TRANSIT LINK'}
                      </span>
                    </div>
                    <div className="font-mono text-xs font-bold text-orange-400 shrink-0 ml-2">
                      {bus.anchorEtaMin > 0 ? `${bus.anchorEtaMin}m` : '0m (ARR)'}
                    </div>
                  </div>

                  {/* Occupancy Indicator */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <Users className="w-3 h-3 text-slate-500 shrink-0" />
                    <div className="flex-1 bg-black/40 rounded-full h-1 overflow-hidden border border-white/5">
                      <div
                        style={{ width: `${ridershipPct}%` }}
                        className={`h-full rounded-full ${
                          ridershipPct > 80
                            ? 'bg-rose-500'
                            : ridershipPct > 50
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                        }`}
                      />
                    </div>
                    <span className="shrink-0 text-[10px]">
                      {bus.occupancy.ridership}/{bus.occupancy.capacity || 88}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function pollCountdownDisplay(s: number): string {
  return `0${s}S`;
}
