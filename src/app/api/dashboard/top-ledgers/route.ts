import { NextRequest, NextResponse } from 'next/server';
import { DashboardService } from '@/lib/dashboard-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    const limit = parseInt(searchParams.get('limit') || '10');
    const data = await new DashboardService().getTopLedgers(companyId, limit);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
