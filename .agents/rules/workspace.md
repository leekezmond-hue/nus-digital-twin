# NUS 3D Digital Twin & Transit Tracker Rules

## Technology Stack & Architectural Conventions
- Framework: Next.js 14/15 App Router with TypeScript and Tailwind CSS.
- Map Engine: MapLibre GL JS (`maplibre-gl`). Always import `maplibre-gl/dist/maplibre-gl.css`.
- Basemap: OpenFreeMap Dark Mode vector style (`https://tiles.openfreemap.org/styles/dark`). 100% free, open CORS, zero API keys, zero rate limits, and zero watermarks. Do NOT use Carto or Mapbox tile URLs.
- 3D Rendering: Three.js (`three`) for custom 3D vehicle models, lighting, and spatial calculations.

## Client-Side Isolation & WebGL Zero-SSR Rule
- Mandatory Client-Only Map Import: MapLibre GL and Three.js access browser-only globals (`window`, `document`, `WebGLRenderingContext`). In `app/page.tsx`, you MUST import `MapCanvas` exclusively via Next.js dynamic client import with `{ ssr: false }`:
  `const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });`
  NEVER import `maplibre-gl` or Three.js in any server component or code evaluated during server-side rendering.

## Payload Size & Data Ingestion Hygiene (< 128 kB)
- Client-Side Data Fetching: `app/page.tsx` must be a client component (`'use client'`). Do NOT fetch buildings on the server during page SSR. Fetch buildings (`/api/buildings`) and live transit (`/api/transit/buses`) inside `useEffect()` on the client side. This prevents serializing 900+ kB of campus GeoJSON into initial server HTML props and prevents Next.js `large-page-data` warnings.
- Route Handler Payload Pruning: In `/api/buildings`, omit raw polygon `footprint` coordinate arrays from the `buildings` array (since footprints are already in `buildingsGeoJson`), but preserve the full nested `eui: { annualTotal, monthlyBreakdown }` object on every building record so client components (`app/page.tsx`, `CampusEnergyChart`, `BuildingEnergyModal`) never fail when reading `.annualTotal` or `.monthlyBreakdown`.

## Geospatial Anchors & NUS Campus Coordinates
- Kent Ridge Campus Center: `[103.7745, 1.2970]` (Longitude, Latitude).
- Campus Bounding Box: `[103.7650, 1.2900, 103.7850, 1.3100]`.
- Default Camera: Pitch `60`, Bearing `-20`, Zoom `16.2`.
- Key Landmark Coordinates:
  - University Town (UTown): `[103.7738, 1.3040]`, Pitch: 60, Bearing: 45
  - School of Computing (COM3): `[103.7745, 1.2944]`, Pitch: 65, Bearing: -30
  - Central Library (CLB): `[103.7725, 1.2966]`, Pitch: 55, Bearing: 10
  - Kent Ridge MRT Station: `[103.7844, 1.2932]`, Pitch: 60, Bearing: -60

## API Contracts & Data Integration
1. NUS Digital Twin API: `https://www.nus-digital-twin.com/api/v1/buildings`
   - Upstream Response Schema: Returns a JSON array of 260 records containing ONLY `{ elementId, name, address, postal, latitude, longitude }`.
   - Procedural Enrichment in `lib/digitaltwin.ts`: Because upstream only provides point coordinates, `lib/digitaltwin.ts` MUST deterministically derive `height` (18m–48m), `floorCount` (4–12), `category` (`academic` | `residential` | `recreation` | `admin`), a ~36m×36m square GeoJSON polygon footprint centered on `[longitude, latitude]`, and a nested `eui: { annualTotal, monthlyBreakdown }` object (`cooling` ~55%, `equipment` ~30%, `lighting` ~15% in kWh/m²).
2. NUS Live Transit Proxy API (GCP Cloud Run): `https://nus-transit-cache-429047621215.asia-southeast1.run.app`
   - Live Proxy Base URL: `https://nus-transit-cache-429047621215.asia-southeast1.run.app`
   - Endpoints:
     - `/api/transit/buses`: Returns `{ asOf, upstreamLastUpdated, stale, estimated: true, buses: [...] }`. Each bus item has `{ id, route, plate, tripStart, status: 'IN_SERVICE' | 'AT_TERMINAL', lat, lng, bearing, speedKmh, arcM, routeLengthM, prevStop, anchorStop, anchorEtaMin, segmentFraction, errorBoundM, occupancy: { ridership, capacity } }`. Positions are rough approximations derived from per-stop ETAs (no public GPS feed exists). UI MUST label positions as *estimated* and display `errorBoundM` on hover/inspector.
     - `/api/transit/stops`: GeoJSON `FeatureCollection` of 33 `Point` features (`coordinates: [lng, lat]`) with `properties: { name, caption, LongName, ShortName, latitude, longitude }` (where `name` is the stop code, e.g. `"UTOWN"`).
     - `/api/transit/routes`: GeoJSON `FeatureCollection` of 8 `LineString` features with `properties: { route, length_m, closed, stops: Array<{ code, arc_m, seq }> }`. Map route colors on the client/backend (e.g. A1 `#EF4444`, A2 `#F59E0B`, D1 `#3B82F6`, D2 `#10B981`, K `#8B5CF6`, L `#EC4899`, E `#14B8A6`, BTC `#F97316`).
     - `/api/stop/:code`: Cached raw upstream timings for individual stops.
   - Off-Service Handling: Outside operating hours (07:00–23:00 SGT) or when `buses` array is empty, display scheduled operating resumption notices. Do not run synthetic fake wandering simulations.

## 3D Rendering & WebGL Conventions
- 3D Building Extrusions (`campus-3d-buildings`): Extruded physical footprints based on building height (18m–48m), colored by category (#38bdf8 academic, #c084fc residential, #34d399 recreation, #fbbf24 admin).
- 3D Energy Pillars (`campus-energy-pillars`): Concentrated 14m x 14m core polygons rising vertically from building rooftops (`fill-extrusion-base = height`, `fill-extrusion-height = height + (eui * 0.75)`, where the GeoJSON feature property `eui` is set to the numeric `building.eui.annualTotal`). Color dynamically using MapLibre `step` expression:
  - Efficient (< 160 kWh/m²): Green `#10B981`
  - Moderate (160–200 kWh/m²): Yellow `#F59E0B`
  - Energy Intensive (> 200 kWh/m²): Red `#EF4444`
- Revised 3D Bus Renderer (`nus-shuttle-bus-3d`): Three.js custom layer registered strictly *after* route polylines (layer ordering: roads -> routes -> 3D buses). Self-illuminating materials (vibrant orange roof `#FF7200`, crisp white chassis, warm white glowing headlights, taillights, rubber wheels) with 2.5x scale factor. Bus markers must indicate *Estimated Position* and show `errorBoundM` (segment bounds) on tooltip/inspector.
- Three.js Local Campus Matrix Anchor: In `lib/threeBusLayer.ts`, extract the camera projection matrix from `options?.defaultProjectionData?.mainMatrix` (or `options` if passed as a `Float64Array`) to obtain MapLibre's Mercator matrix. Anchor it to Kent Ridge Center `[103.7745, 1.2970]` using double-precision matrix multiplication (`camera.projectionMatrix = m.multiply(l)`, where `l` translates to the campus origin and scales with `meterInMercatorCoordinateUnits()`). Position each active bus in local meters `(dx, dy, dz)` relative to Kent Ridge Center so WebGL 32-bit float shaders render crisp, full-sized 3D vehicles without precision loss or depth clipping.
- MapLibre Async Data Synchronization: `components/MapCanvas.tsx` must store incoming `activeBuses`, `buildingsGeoJson`, and `stopsAndRoutesGeoJson` in `useRef`s or sync them both on `map.on('load')` and inside update effects. If `map.isStyleLoaded()` is false when new data arrives, defer source updates until the `load` or `styledata` event so asynchronously fetched transit data is never dropped.
- Dark Basemap Specification: Set `style: 'https://tiles.openfreemap.org/styles/dark'` in `components/MapCanvas.tsx`. OpenFreeMap provides high-contrast dark vector tiles (PBF) with sharp typography, open CORS, zero API keys, and zero watermarks.
- Campus Energy Efficiency Bar Chart: Sorts and displays buildings ranked by efficiency (lowest EUI = rank #1) with click-to-fly 3D camera navigation.
- Building Energy Inspector HUD: Floating glassmorphic sheet showing 12-month energy profiles when a building or pillar is clicked.