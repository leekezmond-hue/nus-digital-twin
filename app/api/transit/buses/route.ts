import { NextResponse, connection } from 'next/server';
import { fetchLiveBuses } from '@/lib/transit';

export async function GET() {
  await connection();
  try {
    const transitState = await fetchLiveBuses();
    return NextResponse.json(transitState, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[/api/transit/buses] Error proxying bus telemetry:', err);
    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        stale: true,
        estimated: true,
        buses: [],
        isOffService: false,
        message: 'Transit telemetry endpoint temporarily unavailable.',
      },
      { status: 500 }
    );
  }
}

