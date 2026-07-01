import { NextRequest, NextResponse } from 'next/server';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

export async function POST(request: NextRequest) {
  const { host, port } = await request.json();
  if (!host || !port) {
    return NextResponse.json({ success: false, error: 'Host and port are required' }, { status: 400 });
  }
  try {
    const fetcher = new TallyDataFetcher({ host, port });
    await fetcher.fetchReport('CompanyInfo');
    return NextResponse.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
