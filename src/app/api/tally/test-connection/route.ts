import { NextRequest, NextResponse } from 'next/server';
import { TallyDataFetcher } from '@/lib/tally-fetcher';

function isPrivateHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
    host.startsWith('192.168.') || host.startsWith('10.') ||
    host.startsWith('172.16.') || host.startsWith('172.17.') ||
    host.startsWith('172.18.') || host.startsWith('172.19.') ||
    host.startsWith('172.20.') || host.startsWith('172.21.') ||
    host.startsWith('172.22.') || host.startsWith('172.23.') ||
    host.startsWith('172.24.') || host.startsWith('172.25.') ||
    host.startsWith('172.26.') || host.startsWith('172.27.') ||
    host.startsWith('172.28.') || host.startsWith('172.29.') ||
    host.startsWith('172.30.') || host.startsWith('172.31.');
}

export async function POST(request: NextRequest) {
  const { host, port } = await request.json();
  if (!host || !port) {
    return NextResponse.json({ success: false, error: 'Host and port are required' }, { status: 400 });
  }

  const isVercel = !!process.env.VERCEL;

  if (isVercel && isPrivateHost(host)) {
    return NextResponse.json({
      success: false,
      error: 'Cannot connect to local Tally from cloud deployment. Run the Tally Agent on your PC to sync data, or use the app locally with `npm run dev`.',
    }, { status: 400 });
  }

  try {
    const fetcher = new TallyDataFetcher({ host, port });
    await fetcher.fetchReport('CompanyInfo');
    return NextResponse.json({ success: true, message: 'Connected successfully' });
  } catch (error: any) {
    const msg = error?.message || 'Connection failed';
    const isTimeout = msg.includes('timeout') || msg.includes('TIMEOUT');
    const isRefused = msg.includes('refused') || msg.includes('ECONNREFUSED');

    let userMessage: string;
    if (isVercel) {
      userMessage = 'Tally is not reachable from this server. Make sure Tally is running and accessible, or install the Tally Agent on your PC.';
    } else if (isTimeout) {
      userMessage = 'Connection timed out. Check that Tally is running and port 9000 is open.';
    } else if (isRefused) {
      userMessage = 'Connection refused. Ensure Tally is open and Tally.NET / XML Server is enabled (Gateway: On).';
    } else {
      userMessage = msg;
    }

    return NextResponse.json({ success: false, error: userMessage }, { status: 502 });
  }
}
