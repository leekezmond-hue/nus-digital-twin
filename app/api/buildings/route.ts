import { NextResponse } from 'next/server';
import { fetchCampusDigitalTwin } from '@/lib/digitaltwin';

export async function GET() {
  try {
    const result = await fetchCampusDigitalTwin();

    // Payload hygiene (<128 kB rule):
    // Strip redundant footprint coordinate arrays from the buildings array
    // while keeping the full nested eui: { annualTotal, monthlyBreakdown } object on every record.
    const prunedBuildings = result.buildings.map(({ footprint, ...building }) => building);

    return NextResponse.json(
      {
        buildings: prunedBuildings,
        buildingsGeoJson: result.buildingsGeoJson,
        energyPillarsGeoJson: result.energyPillarsGeoJson,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/buildings] Error generating digital twin data:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve NUS Digital Twin buildings data' },
      { status: 500 }
    );
  }
}

