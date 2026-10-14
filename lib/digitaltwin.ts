import { CampusBuilding, BuildingCategory, BuildingEnergy, MonthlyEnergy } from './types';

const NUS_DIGITAL_TWIN_API =
  process.env.NUS_DIGITAL_TWIN_API || 'https://www.nus-digital-twin.com/api/v1/buildings';

// Known iconic landmarks for fallback resilience
export const LANDMARK_FALLBACKS: Array<{
  elementId: string;
  name: string;
  address: string;
  postal: string;
  latitude: number;
  longitude: number;
  category: BuildingCategory;
}> = [
  {
    elementId: 'COM3',
    name: 'School of Computing COM3',
    address: '11 Research Link',
    postal: '119391',
    latitude: 1.2944,
    longitude: 103.7745,
    category: 'academic',
  },
  {
    elementId: 'UTOWN_SRC',
    name: 'Stephen Riady Centre (UTown)',
    address: '2 College Avenue West',
    postal: '138607',
    latitude: 1.304,
    longitude: 103.7738,
    category: 'recreation',
  },
  {
    elementId: 'CLB',
    name: 'Central Library (CLB)',
    address: '12 Kent Ridge Crescent',
    postal: '119275',
    latitude: 1.2966,
    longitude: 103.7725,
    category: 'academic',
  },
  {
    elementId: 'S17',
    name: 'Faculty of Science S17',
    address: '10 Lower Kent Ridge Road',
    postal: '119076',
    latitude: 1.2974,
    longitude: 103.7801,
    category: 'academic',
  },
];

export const CATEGORY_COLORS: Record<BuildingCategory, string> = {
  academic: '#38bdf8', // Sky blue
  residential: '#c084fc', // Purple
  recreation: '#34d399', // Mint green
  admin: '#fbbf24', // Amber gold
};

// Deterministic string hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Category heuristic based on building name
export function deriveCategory(name: string): BuildingCategory {
  const lower = name.toLowerCase();
  if (
    lower.includes('hall') ||
    lower.includes('residence') ||
    lower.includes('house') ||
    lower.includes('pgr') ||
    lower.includes('pgp') ||
    lower.includes('rc') ||
    lower.includes('college')
  ) {
    return 'residential';
  }
  if (
    lower.includes('gym') ||
    lower.includes('mpsh') ||
    lower.includes('sports') ||
    lower.includes('pool') ||
    lower.includes('amphitheatre') ||
    lower.includes('src')
  ) {
    return 'recreation';
  }
  if (
    lower.includes('admin') ||
    lower.includes('foyer') ||
    lower.includes('office') ||
    lower.includes('university hall') ||
    lower.includes('canteen') ||
    lower.includes('iss') ||
    lower.includes('water tank')
  ) {
    return 'admin';
  }
  return 'academic';
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Procedural 12-month EUI generation (cooling ~55%, equipment ~30%, lighting ~15%)
export function deriveEnergyProfile(seed: number, category: BuildingCategory): BuildingEnergy {
  // Base annual total between 130 and 240 kWh/m² depending on category & seed
  const categoryOffset =
    category === 'academic' ? 25 :
    category === 'recreation' ? 15 :
    category === 'admin' ? 10 : 0;

  const baseAnnual = 130 + (seed % 80) + categoryOffset;

  // Monthly factors simulating Singapore's warmer mid-year climate
  const monthlyFactors = [
    0.95, 0.96, 1.04, 1.06, 1.08, 1.07,
    1.03, 1.02, 1.01, 0.99, 0.94, 0.93,
  ];

  const avgMonthly = baseAnnual / 12;
  const monthlyBreakdown: MonthlyEnergy[] = MONTH_NAMES.map((month, idx) => {
    const factor = monthlyFactors[idx];
    const monthTotal = Math.round(avgMonthly * factor * 10) / 10;
    const cooling = Math.round(monthTotal * 0.55 * 10) / 10;
    const equipment = Math.round(monthTotal * 0.3 * 10) / 10;
    const lighting = Math.round((monthTotal - cooling - equipment) * 10) / 10;
    return {
      month,
      cooling,
      equipment,
      lighting,
      total: monthTotal,
    };
  });

  const annualTotal = Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.total, 0) * 10) / 10;

  return {
    annualTotal,
    monthlyBreakdown,
  };
}

// Generates ~36m x 36m square polygon centered at [longitude, latitude]
export function deriveFootprintPolygon(
  lng: number,
  lat: number,
  sideMeters = 36
): [number, number][] {
  const half = sideMeters / 2;
  const dLat = half / 111320;
  const dLng = half / (111320 * Math.cos((lat * Math.PI) / 180));

  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat], // Close polygon
  ];
}

// Procedural enrichment of upstream building point record
export function enrichBuildingRecord(raw: {
  elementId: string;
  name: string;
  address?: string;
  postal?: string;
  latitude: number;
  longitude: number;
}): CampusBuilding {
  const seed = hashString(raw.elementId + raw.name);
  const category = deriveCategory(raw.name);

  // Height between 18m and 48m
  const height = 18 + (seed % 31);
  const floorCount = Math.max(4, Math.min(12, Math.round(height / 3.8)));
  const eui = deriveEnergyProfile(seed, category);
  const footprint = deriveFootprintPolygon(raw.longitude, raw.latitude, 36);

  return {
    elementId: raw.elementId,
    name: raw.name,
    address: raw.address || 'Kent Ridge Campus',
    postal: raw.postal || '119077',
    latitude: raw.latitude,
    longitude: raw.longitude,
    height,
    floorCount,
    category,
    eui,
    footprint,
  };
}

export interface DigitalTwinResult {
  buildings: CampusBuilding[];
  buildingsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  energyPillarsGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
}

// Fetch and build enriched buildings & GeoJSON collections
export async function fetchCampusDigitalTwin(): Promise<DigitalTwinResult> {
  let rawList: Array<{
    elementId: string;
    name: string;
    address?: string;
    postal?: string;
    latitude: number;
    longitude: number;
  }> = [];

  try {
    const res = await fetch(NUS_DIGITAL_TWIN_API, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        rawList = data;
      }
    }
  } catch (err) {
    console.warn('[DigitalTwin] Upstream fetch failed, applying landmark fallbacks:', err);
  }

  // Ensure iconic landmarks exist if missing from upstream
  const existingIds = new Set(rawList.map((b) => b.elementId));
  for (const landmark of LANDMARK_FALLBACKS) {
    if (!existingIds.has(landmark.elementId)) {
      rawList.push(landmark);
    }
  }

  const buildings = rawList.map(enrichBuildingRecord);

  // Generate GeoJSON collections
  const buildingFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = buildings.map((b) => ({
    type: 'Feature',
    id: b.elementId,
    geometry: {
      type: 'Polygon',
      coordinates: [b.footprint || deriveFootprintPolygon(b.longitude, b.latitude, 36)],
    },
    properties: {
      elementId: b.elementId,
      name: b.name,
      address: b.address,
      category: b.category,
      height: b.height,
      floorCount: b.floorCount,
      color: CATEGORY_COLORS[b.category],
      eui: b.eui.annualTotal,
    },
  }));

  // Generate 14m x 14m core rooftop Energy Pillars
  const pillarFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = buildings.map((b) => {
    const pillarFootprint = deriveFootprintPolygon(b.longitude, b.latitude, 14);
    const pillarHeight = b.height + b.eui.annualTotal * 0.75;
    return {
      type: 'Feature',
      id: `${b.elementId}-pillar`,
      geometry: {
        type: 'Polygon',
        coordinates: [pillarFootprint],
      },
      properties: {
        elementId: b.elementId,
        name: b.name,
        category: b.category,
        height: b.height, // extrusion base
        pillarHeight, // extrusion top
        eui: b.eui.annualTotal,
      },
    };
  });

  return {
    buildings,
    buildingsGeoJson: {
      type: 'FeatureCollection',
      features: buildingFeatures,
    },
    energyPillarsGeoJson: {
      type: 'FeatureCollection',
      features: pillarFeatures,
    },
  };
}

