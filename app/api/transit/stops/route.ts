import { NextResponse } from 'next/server';
import { fetchCampusStops, fetchCampusRoutes } from '@/lib/transit';

export async function GET() {
  try {
    const [stopsGeoJson, routesGeoJson] = await Promise.all([
      fetchCampusStops(),
      fetchCampusRoutes(),
    ]);

    return NextResponse.json(
      {
        stopsGeoJson,
        routesGeoJson,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/transit/stops] Error fetching stops and routes:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve NUS transit stops and routes' },
      { status: 500 }
    );
  }
}

