import { NextRequest, NextResponse } from 'next/server';
import { getVisitorStats, TimeRangeKey } from '@/lib/analytics/visitorStats';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d') as TimeRangeKey;

    const data = await getVisitorStats(range);

    return NextResponse.json({
      success: true,
      data
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error: any) {
    console.error('[VISITOR STATS ERROR]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch visitor stats' },
      { status: 500 }
    );
  }
}
