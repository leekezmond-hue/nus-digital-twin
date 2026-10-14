'use client';

import React, { useState, useMemo } from 'react';
import { CampusBuilding, BuildingCategory, CameraTarget } from '@/lib/types';
import { Zap, TrendingDown, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';

interface CampusEnergyChartProps {
  buildings: CampusBuilding[];
  onSelectBuilding: (building: CampusBuilding) => void;
  onFocusTarget: (target: CameraTarget) => void;
}

export default function CampusEnergyChart({
  buildings,
  onSelectBuilding,
  onFocusTarget,
}: CampusEnergyChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = most efficient (#1)
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Filter & sort
  const rankedBuildings = useMemo(() => {
    let list = buildings.filter((b) => b.eui?.annualTotal > 0);
    if (selectedCategory !== 'all') {
      list = list.filter((b) => b.category === selectedCategory);
    }
    return list.sort((a, b) =>
      sortOrder === 'asc'
        ? a.eui.annualTotal - b.eui.annualTotal
        : b.eui.annualTotal - a.eui.annualTotal
    );
  }, [buildings, selectedCategory, sortOrder]);

  const maxEui = useMemo(() => {
    if (rankedBuildings.length === 0) return 300;
    return Math.max(...rankedBuildings.map((b) => b.eui.annualTotal));
  }, [rankedBuildings]);

  return (
    <div className="absolute bottom-4 left-4 z-20 w-84 sm:w-96 font-sans transition-all">
      <div className="bg-[#0D1117]/92 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 tracking-wider uppercase font-mono">
                ENERGY // RANKING
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Ranked by EUI (kWh/m²/yr)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 text-[10px] text-slate-300 bg-black/40 hover:bg-white/[0.06] px-2 py-1 rounded border border-white/[0.08] transition-colors"
              title="Toggle sort order"
            >
              {sortOrder === 'asc' ? (
                <>
                  <TrendingDown className="w-3 h-3 text-cyan-400" />
                  <span>EFFICIENT</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-purple-400" />
                  <span>INTENSIVE</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/[0.06]"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 px-3 pt-2 pb-2 border-b border-white/[0.06] overflow-x-auto text-[10px]">
              {(['all', 'academic', 'residential', 'recreation', 'admin'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded capitalize font-mono transition-all border ${
                    selectedCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-black/30 text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Efficiency Leaderboard List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04] p-1.5">
              {rankedBuildings.slice(0, 30).map((b, idx) => {
                const eui = b.eui.annualTotal;
                const barWidth = Math.min(100, Math.round((eui / maxEui) * 100));
                const rankFormatted = String(idx + 1).padStart(2, '0');

                // Cyan-to-Violet Spectrum (<160 Cyan, 160-200 Cobalt, >200 Neon Purple)
                const barColor =
                  eui < 160
                    ? 'bg-cyan-500'
                    : eui <= 200
                    ? 'bg-blue-500'
                    : 'bg-purple-500';

                return (
                  <div
                    key={b.elementId}
                    onClick={() => {
                      onSelectBuilding(b);
                      onFocusTarget({
                        lng: b.longitude,
                        lat: b.latitude,
                        zoom: 17.2,
                        pitch: 65,
                        bearing: -25,
                      });
                    }}
                    className="p-1.5 hover:bg-white/[0.04] rounded transition-all cursor-pointer group flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className={`font-mono text-[10px] ${
                            idx === 0
                              ? 'text-cyan-400 font-bold'
                              : idx < 3
                              ? 'text-blue-400'
                              : 'text-slate-500'
                          }`}
                        >
                          [{rankFormatted}]
                        </span>
                        <span className="font-sans text-xs text-slate-200 group-hover:text-cyan-400 truncate">
                          {b.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 shrink-0">
                        {eui.toFixed(1)}{' '}
                        <span className="text-[9px] text-slate-500">kWh/m²</span>
                      </span>
                    </div>

                    {/* Progress Bar with Cyan-to-Violet Spectrum */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-black/40 rounded-full h-1 overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${barWidth}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 capitalize shrink-0 font-sans">
                        {b.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
