import { NextRequest, NextResponse } from 'next/server';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function POST(request: NextRequest) {
  const { host, port, companyName, isRemote, gatewayId } = await request.json();
  try {
    const fetcher = new TallyDataFetcher({ host, port, companyName: companyName || '', isRemote, gatewayId, authToken: null });
    await fetcher.fetchReport('CompanyInfo');
    return NextResponse.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
