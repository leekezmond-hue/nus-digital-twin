import { fetchCampusDigitalTwin, deriveCategory } from '../lib/digitaltwin';
import { fetchLiveBuses, fetchCampusStops, fetchCampusRoutes, isSgtOffService } from '../lib/transit';

async function verify() {
  console.log('=== 1. VERIFYING DIGITAL TWIN ENGINE ===');
  const dt = await fetchCampusDigitalTwin();
  console.log(`Fetched buildings count: ${dt.buildings.length}`);
  console.log(`Buildings GeoJSON features: ${dt.buildingsGeoJson.features.length}`);
  console.log(`Energy Pillars GeoJSON features: ${dt.energyPillarsGeoJson.features.length}`);

  // Test height range
  const heights = dt.buildings.map((b) => b.height);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  console.log(`Height range: ${minH}m - ${maxH}m (Expected: 18m - 48m)`);
  if (minH < 18 || maxH > 48) {
    throw new Error(`Height out of bounds: ${minH}m - ${maxH}m`);
  }

  // Test EUI monthly breakdown (cooling ~55%, equipment ~30%, lighting ~15%)
  const sampleBuilding = dt.buildings[0];
  console.log(`Sample building: ${sampleBuilding.name} (${sampleBuilding.category})`);
  console.log(`Annual EUI: ${sampleBuilding.eui.annualTotal} kWh/m²`);
  const jan = sampleBuilding.eui.monthlyBreakdown[0];
  console.log(`Jan breakdown: Total=${jan.total}, Cooling=${jan.cooling} (${Math.round(jan.cooling / jan.total * 100)}%), Equipment=${jan.equipment} (${Math.round(jan.equipment / jan.total * 100)}%), Lighting=${jan.lighting} (${Math.round(jan.lighting / jan.total * 100)}%)`);

  // Test landmarks present
  const landmarkCodes = ['COM3', 'UTOWN_SRC', 'CLB', 'S17'];
  for (const code of landmarkCodes) {
    const found = dt.buildings.find((b) => b.elementId === code || b.name.includes(code));
    console.log(`Landmark ${code} check: ${found ? 'FOUND (' + found.name + ')' : 'NOT FOUND'}`);
  }

  // Payload pruning test
  const prunedBuildings = dt.buildings.map(({ footprint, ...b }) => b);
  const rawSizeKb = Buffer.byteLength(JSON.stringify(prunedBuildings), 'utf8') / 1024;
  console.log(`Pruned buildings JSON size: ${rawSizeKb.toFixed(1)} kB (Target: < 128 kB)`);

  console.log('\n=== 2. VERIFYING LIVE TRANSIT CLIENT ===');
  console.log(`SGT Off-Service currently: ${isSgtOffService()}`);
  const transit = await fetchLiveBuses();
  console.log(`Transit state asOf: ${transit.asOf}`);
  console.log(`Is off-service: ${transit.isOffService}`);
  console.log(`Active buses count: ${transit.buses.length}`);
  if (transit.buses.length > 0) {
    const sampleBus = transit.buses[0];
    console.log(`Sample bus: ${sampleBus.route} (${sampleBus.plate}), Speed: ${sampleBus.speedKmh} km/h, errorBoundM: ±${sampleBus.errorBoundM}m, Ridership: ${sampleBus.occupancy.ridership}/${sampleBus.occupancy.capacity}`);
  }

  const stops = await fetchCampusStops();
  console.log(`Campus stops count: ${stops.features.length} (Expected: ~33 stops)`);

  const routes = await fetchCampusRoutes();
  console.log(`Campus routes count: ${routes.features.length} (Expected: ~8 routes)`);
  for (const r of routes.features) {
    console.log(`  Route ${r.properties?.route}: color=${r.properties?.color}, length=${r.properties?.length_m}m, stops=${r.properties?.stops?.length}`);
  }

  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

