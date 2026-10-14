import { TransitState, ActiveBus } from './types';

const NUS_TRANSIT_API =
  process.env.NUS_TRANSIT_API ||
  'https://nus-transit-cache-429047621215.asia-southeast1.run.app';

export const ROUTE_COLORS: Record<string, string> = {
  A1: '#EF4444', // Red
  A2: '#F59E0B', // Amber
  D1: '#3B82F6', // Blue
  D2: '#10B981', // Emerald
  K: '#8B5CF6',  // Violet
  L: '#EC4899',  // Pink
  E: '#14B8A6',  // Teal
  BTC: '#F97316', // Orange
};

export const DEFAULT_ROUTE_COLOR = '#94A3B8';

// Evaluates whether current time in Asia/Singapore (SGT) is outside 07:00-23:00
export function isSgtOffService(): boolean {
  try {
    const sgtHourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = parseInt(sgtHourStr, 10);
    return hour < 7 || hour >= 23;
  } catch {
    // Fallback using UTC offset +8
    const utcHours = new Date().getUTCHours();
    const sgtHours = (utcHours + 8) % 24;
    return sgtHours < 7 || sgtHours >= 23;
  }
}

export async function fetchLiveBuses(): Promise<TransitState> {
  const offService = isSgtOffService();
  if (offService) {
    return {
      asOf: new Date().toISOString(),
      stale: false,
      estimated: true,
      buses: [],
      isOffService: true,
      message: 'NUS Shuttle bus services operate from 07:00 to 23:00 SGT. Service resumes at 07:00 SGT.',
    };
  }

  try {
    const res = await fetch(`${NUS_TRANSIT_API}/api/transit/buses`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Proxy responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawBuses: any[] = Array.isArray(data.buses) ? data.buses : [];

    // Map and sanitize active buses
    const buses: ActiveBus[] = rawBuses.map((b) => ({
      id: String(b.id || `${b.route}-${b.plate}`),
      route: String(b.route || 'Unknown'),
      plate: String(b.plate || 'NUS-BUS'),
      tripStart: String(b.tripStart || ''),
      status: b.status === 'AT_TERMINAL' ? 'AT_TERMINAL' : 'IN_SERVICE',
      lat: Number(b.lat) || 1.297,
      lng: Number(b.lng) || 103.7745,
      bearing: Number(b.bearing) || 0,
      speedKmh: Number(b.speedKmh) || 0,
      arcM: Number(b.arcM) || 0,
      routeLengthM: Number(b.routeLengthM) || 0,
      prevStop: String(b.prevStop || ''),
      anchorStop: String(b.anchorStop || ''),
      anchorEtaMin: Number(b.anchorEtaMin) || 0,
      segmentFraction: Number(b.segmentFraction) || 0,
      errorBoundM: Number(b.errorBoundM) || 0,
      occupancy: {
        ridership: Number(b.occupancy?.ridership) || 0,
        capacity: Number(b.occupancy?.capacity) || 88,
      },
    }));

    return {
      asOf: data.asOf || new Date().toISOString(),
      upstreamLastUpdated: data.upstreamLastUpdated,
      stale: Boolean(data.stale),
      estimated: true,
      buses,
      isOffService: buses.length === 0,
      message:
        buses.length === 0
          ? 'No active shuttle vehicles reported on campus routes.'
          : undefined,
    };
  } catch (err: any) {
    console.error('[Transit] Failed to fetch live buses:', err);
    return {
      asOf: new Date().toISOString(),
      stale: true,
      estimated: true,
      buses: [],
      isOffService: false,
      message: 'Temporarily unable to connect to NUS transit proxy telemetry feed.',
    };
  }
}

export async function fetchCampusStops(): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  try {
    const res = await fetch(`${NUS_TRANSIT_API}/api/transit/stops`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('[Transit] Failed to fetch stops:', err);
  }

  return {
    type: 'FeatureCollection',
    features: [],
  };
}

export async function fetchCampusRoutes(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
  try {
    const res = await fetch(`${NUS_TRANSIT_API}/api/transit/routes`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = await res.json();
      // Inject standard NUS route colors into feature properties
      data.features = data.features.map((feature) => {
        const routeName = String(feature.properties?.route || '');
        const color = ROUTE_COLORS[routeName] || DEFAULT_ROUTE_COLOR;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            color,
          },
        };
      });
      return data;
    }
  } catch (err) {
    console.error('[Transit] Failed to fetch routes:', err);
  }

  return {
    type: 'FeatureCollection',
    features: [],
  };
}

