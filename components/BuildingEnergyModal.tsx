'use client';

import React from 'react';
import { CampusBuilding, CameraTarget } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/digitaltwin';
import { X, Building2, MapPin, Eye, Zap } from 'lucide-react';

interface BuildingEnergyModalProps {
  building: CampusBuilding | null;
  onClose: () => void;
  onFocusTarget: (target: CameraTarget) => void;
}

export default function BuildingEnergyModal({
  building,
  onClose,
  onFocusTarget,
}: BuildingEnergyModalProps) {
  if (!building) return null;

  const eui = building.eui?.annualTotal || 0;
  const breakdown = building.eui?.monthlyBreakdown || [];

  const maxMonthTotal = Math.max(...breakdown.map((m) => m.total), 25);

  // Cyan-to-Violet Spectrum
  const euiBadge =
    eui < 160
      ? { label: 'HIGH EFFICIENCY', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' }
      : eui <= 200
      ? { label: 'MODERATE EUI', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
      : { label: 'INTENSIVE LOAD', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };

  return (
    <div className="absolute top-4 left-4 z-30 w-84 sm:w-105 font-mono animate-in fade-in slide-in-from-left duration-200">
      <div className="bg-[#0D1117]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-3.5 border-b border-white/[0.08] flex items-start justify-between gap-3 bg-black/30">
          <div className="flex items-start gap-2.5">
            <div
              style={{ backgroundColor: `${CATEGORY_COLORS[building.category]}20`, borderColor: `${CATEGORY_COLORS[building.category]}40` }}
              className="p-2 rounded border shrink-0 mt-0.5"
            >
              <Building2 className="w-4 h-4" style={{ color: CATEGORY_COLORS[building.category] }} />
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  style={{ backgroundColor: `${CATEGORY_COLORS[building.category]}15`, color: CATEGORY_COLORS[building.category] }}
                  className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border border-current/25"
                >
                  {building.category}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${euiBadge.color}`}>
                  {euiBadge.label}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white leading-snug font-sans tracking-tight">
                {building.name}
              </h2>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{building.address}, Singapore {building.postal}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Spatial & Physical Specs */}
        <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-black/40 border-b border-white/[0.06] text-center text-[10px]">
          <div className="bg-white/[0.02] p-2 rounded border border-white/5">
            <div className="text-slate-500 uppercase font-semibold text-[9px]">Height</div>
            <div className="font-mono text-xs font-bold text-cyan-400 mt-0.5">{building.height}m</div>
          </div>
          <div className="bg-white/[0.02] p-2 rounded border border-white/5">
            <div className="text-slate-500 uppercase font-semibold text-[9px]">Storeys</div>
            <div className="font-mono text-xs font-bold text-purple-400 mt-0.5">{building.floorCount}F</div>
          </div>
          <div className="bg-white/[0.02] p-2 rounded border border-white/5">
            <div className="text-slate-500 uppercase font-semibold text-[9px]">Annual EUI</div>
            <div className="font-mono text-xs font-bold text-blue-400 mt-0.5">{eui.toFixed(1)} <span className="text-[9px] font-normal text-slate-500">kWh/m²</span></div>
          </div>
        </div>

        {/* 12-Month EUI Breakdown Chart */}
        <div className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>12-MONTH PROFILE</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              EST: {Math.round(eui * 1296)} kWh/yr
            </div>
          </div>

          {/* Sub-metering legend (Cyan-to-Violet Spectrum) */}
          <div className="flex items-center justify-between text-[10px] bg-black/40 p-1.5 rounded border border-white/5 font-mono">
            <div className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-2 rounded-xs bg-cyan-500 inline-block" />
              <span>COOLING (55%)</span>
            </div>
            <div className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-xs bg-blue-500 inline-block" />
              <span>EQUIP (30%)</span>
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <span className="w-2 h-2 rounded-xs bg-purple-400 inline-block" />
              <span>LIGHT (15%)</span>
            </div>
          </div>

          {/* Stacked Monthly Bars */}
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {breakdown.map((m) => {
              const coolingPct = (m.cooling / maxMonthTotal) * 100;
              const equipPct = (m.equipment / maxMonthTotal) * 100;
              const lightingPct = (m.lighting / maxMonthTotal) * 100;

              return (
                <div key={m.month} className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono text-slate-400 w-6 shrink-0 text-right">
                    {m.month}
                  </span>
                  <div className="flex-1 bg-black/40 rounded h-2.5 flex overflow-hidden border border-white/5">
                    <div
                      style={{ width: `${coolingPct}%` }}
                      className="bg-cyan-500 h-full hover:brightness-110 transition-all"
                      title={`Cooling: ${m.cooling} kWh/m²`}
                    />
                    <div
                      style={{ width: `${equipPct}%` }}
                      className="bg-blue-500 h-full hover:brightness-110 transition-all"
                      title={`Equipment: ${m.equipment} kWh/m²`}
                    />
                    <div
                      style={{ width: `${lightingPct}%` }}
                      className="bg-purple-400 h-full hover:brightness-110 transition-all"
                      title={`Lighting: ${m.lighting} kWh/m²`}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-300 w-9 shrink-0 text-right">
                    {m.total.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Fly-to Button (Snappy Tactical Profile) */}
          <div className="pt-1">
            <button
              onClick={() =>
                onFocusTarget({
                  lng: building.longitude,
                  lat: building.latitude,
                  zoom: 17.2,
                  pitch: 65,
                  bearing: -25,
                })
              }
              className="w-full flex items-center justify-center gap-2 bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white text-xs font-mono py-1.5 px-3 rounded transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>NAVIGATE TACTICAL 3D CAMERA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
