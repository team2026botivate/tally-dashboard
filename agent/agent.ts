import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import * as dotenv from 'dotenv';
import si from 'systeminformation';

dotenv.config();

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const GATEWAY_ID = process.env.GATEWAY_ID || '';
const DEVICE_SECRET = process.env.DEVICE_SECRET || '';
const TALLY_HOST = process.env.TALLY_HOST || 'localhost';
const TALLY_PORT = process.env.TALLY_PORT || '9000';

if (!GATEWAY_ID || !DEVICE_SECRET) {
  console.error('[Agent] ERROR: GATEWAY_ID and DEVICE_SECRET must be configured in .env');
  process.exit(1);
}

const TALLY_URL = `http://${TALLY_HOST}:${TALLY_PORT}`;

console.log('[Agent] Initializing Tally Remote Gateway Agent...');
console.log(`[Agent] Gateway URL: ${GATEWAY_URL}`);
console.log(`[Agent] Client ID: ${GATEWAY_ID}`);
console.log(`[Agent] Target Tally: ${TALLY_URL}`);

let socket: Socket;

async function getDeviceInfo() {
  try {
    const osInfo = await si.osInfo();
    const system = await si.system();
    const network = await si.networkInterfaces();
    
    // Find primary IP
    const primaryInterface = Array.isArray(network) 
      ? network.find(i => !i.internal && i.ip4) 
      : null;

    return {
      os: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      hostname: osInfo.hostname,
      manufacturer: system.manufacturer,
      model: system.model,
      privateIp: primaryInterface ? primaryInterface.ip4 : '127.0.0.1',
      agentVersion: '1.0.0'
    };
  } catch (err: any) {
    console.warn('[Agent] Could not collect all system info:', err.message);
    return {
      os: process.platform,
      hostname: require('os').hostname(),
      privateIp: '127.0.0.1',
      agentVersion: '1.0.0'
    };
  }
}

async function start() {
  const deviceInfo = await getDeviceInfo();

  socket = io(GATEWAY_URL, {
    auth: {
      gatewayId: GATEWAY_ID,
      deviceSecret: DEVICE_SECRET
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5
  });

  socket.on('connect', () => {
    console.log('[Agent] Connected to Cloud Gateway server successfully.');
    sendHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[Agent] Disconnected from Gateway: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('[Agent] Connection error:', error.message);
  });

  // Handle incoming request tunnel
  socket.on('tally:request', async (data: { requestId: string; xml: string }) => {
    console.log(`[Agent] Received Tally request [ID: ${data.requestId}]`);
    try {
      const response = await axios.post(TALLY_URL, data.xml, {
        headers: { 
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        },
        timeout: 30000
      });
      console.log(`[Agent] Tally responded successfully for request [ID: ${data.requestId}]`);
      socket.emit('tally:response', {
        requestId: data.requestId,
        xml: response.data
      });
    } catch (err: any) {
      const errMsg = err.code === 'ECONNREFUSED' 
        ? `Local Tally is not running on ${TALLY_URL}. Ensure Tally is open with ODBC/XML enabled on port ${TALLY_PORT}.`
        : err.message;
      console.error(`[Agent] Failed to fetch Tally request [ID: ${data.requestId}]:`, errMsg);
      socket.emit('tally:response', {
        requestId: data.requestId,
        error: errMsg
      });
    }
  });

  // Periodical heartbeats (every 30 seconds)
  setInterval(() => {
    if (socket.connected) {
      sendHeartbeat();
    }
  }, 30000);

  async function sendHeartbeat() {
    socket.emit('tally:heartbeat', { deviceInfo });
  }
}

start().catch(err => {
  console.error('[Agent] Fatal error during agent startup:', err);
  process.exit(1);
});
