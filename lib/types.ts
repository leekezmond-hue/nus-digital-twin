export interface MonthlyEnergy {
  month: string;
  cooling: number;
  equipment: number;
  lighting: number;
  total: number;
}

export interface BuildingEnergy {
  annualTotal: number; // kWh/m²/year
  monthlyBreakdown: MonthlyEnergy[];
}

export type BuildingCategory = 'academic' | 'residential' | 'recreation' | 'admin';

export interface CampusBuilding {
  elementId: string;
  name: string;
  address: string;
  postal: string;
  latitude: number;
  longitude: number;
  height: number; // 18m - 48m
  floorCount: number; // 4 - 12
  category: BuildingCategory;
  eui: BuildingEnergy;
  footprint?: [number, number][]; // [longitude, latitude][]
}

export interface ShuttleEta {
  busId: string;
  route: string;
  plate: string;
  etaMin: number;
  speedKmh: number;
}

export interface BusStop {
  name: string; // Stop code, e.g. "UTOWN", "COM3"
  caption: string;
  LongName: string;
  ShortName: string;
  latitude: number;
  longitude: number;
}

export interface BusOccupancy {
  ridership: number;
  capacity: number;
}

export interface ActiveBus {
  id: string;
  route: string;
  plate: string;
  tripStart: string;
  status: 'IN_SERVICE' | 'AT_TERMINAL';
  lat: number;
  lng: number;
  bearing: number;
  speedKmh: number;
  arcM: number;
  routeLengthM: number;
  prevStop: string;
  anchorStop: string;
  anchorEtaMin: number;
  segmentFraction: number;
  errorBoundM: number; // Segment estimation error bounds in meters
  occupancy: BusOccupancy;
}

export interface RouteStopRef {
  code: string;
  arc_m: number;
  seq: number;
}

export interface CampusRoute {
  route: string;
  length_m: number;
  closed: boolean;
  stops: RouteStopRef[];
  color: string;
}

export interface TransitState {
  asOf: string;
  upstreamLastUpdated?: string;
  stale: boolean;
  estimated: boolean;
  buses: ActiveBus[];
  isOffService: boolean;
  message?: string;
}

export interface CameraTarget {
  lng: number;
  lat: number;
  pitch?: number;
  bearing?: number;
  zoom?: number;
}

