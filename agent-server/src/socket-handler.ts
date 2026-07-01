import { Server, Socket } from 'socket.io';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface PendingRequest {
  resolve: (xml: string) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
}

const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000';

class SocketServer {
  private io: Server | null = null;
  private activeConnections = new Map<string, Socket>();
  private pendingRequests = new Map<string, PendingRequest>();

  init(httpServer: any) {
    // Already initialized via initSocketServer(io)
  }

  setIo(io: Server) {
    this.io = io;
    this.setupHandlers();
  }

  private setupHandlers() {
    if (!this.io) return;

    this.io.use(async (socket: Socket, next: (err?: Error) => void) => {
      const gatewayId = socket.handshake.auth.gatewayId;
      const deviceSecret = socket.handshake.auth.deviceSecret;

      if (!gatewayId || !deviceSecret) {
        return next(new Error('Authentication failed: Missing gatewayId or deviceSecret'));
      }

      try {
        const res = await axios.get(`${NEXTJS_URL}/api/config`);
        // Validate via Next.js API
        const configRes = await axios.get(`${NEXTJS_URL}/api/config/all`);
        const configs = configRes.data || [];
        const config = configs.find((c: any) => c.gatewayId === gatewayId);

        if (!config || !config.deviceSecretHash) {
          return next(new Error('Authentication failed: Gateway not found or unconfigured'));
        }

        const isMatch = await bcrypt.compare(deviceSecret, config.deviceSecretHash);
        if (!isMatch) {
          return next(new Error('Authentication failed: Invalid credentials'));
        }

        socket.data = { gatewayId, configId: config.id };
        next();
      } catch (err: any) {
        console.error('Socket authentication error:', err);
        next(new Error('Authentication failed: Server error'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const { gatewayId, configId } = socket.data;
      console.log(`[SocketServer] Gateway client connected: ${gatewayId}`);

      const existingSocket = this.activeConnections.get(gatewayId);
      if (existingSocket) {
        console.log(`[SocketServer] Disconnecting duplicate socket for: ${gatewayId}`);
        existingSocket.disconnect();
      }

      this.activeConnections.set(gatewayId, socket);
      this.updateGatewayStatus(configId, 'ONLINE');

      socket.on('tally:heartbeat', async (data: { deviceInfo: any }) => {
        try {
          await axios.patch(`${NEXTJS_URL}/api/config/${configId}`, {
            status: 'ONLINE',
            lastHeartbeatAt: new Date().toISOString(),
            deviceInfo: data.deviceInfo || {}
          });
        } catch (err: any) {
          console.error(`[SocketServer] Heartbeat update error for ${gatewayId}:`, err.message);
        }
      });

      socket.on('tally:response', (data: { requestId: string; xml?: string; error?: string }) => {
        const pending = this.pendingRequests.get(data.requestId);
        if (!pending) return;

        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(data.requestId);

        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.xml || '');
        }
      });

      socket.on('disconnect', () => {
        console.log(`[SocketServer] Gateway client disconnected: ${gatewayId}`);
        if (this.activeConnections.get(gatewayId) === socket) {
          this.activeConnections.delete(gatewayId);
          this.updateGatewayStatus(configId, 'OFFLINE');
        }
      });
    });
  }

  private async updateGatewayStatus(configId: string, status: string) {
    try {
      await axios.patch(`${NEXTJS_URL}/api/config/${configId}`, { status });
    } catch (err: any) {
      console.error(`[SocketServer] Status update error for config ${configId}:`, err.message);
    }
  }

  isOnline(gatewayId: string): boolean {
    return this.activeConnections.has(gatewayId);
  }

  async sendRequest(gatewayId: string, xmlPayload: string, timeoutMs = 45000): Promise<string> {
    const socket = this.activeConnections.get(gatewayId);
    if (!socket) {
      throw new Error(`Gateway client '${gatewayId}' is offline`);
    }

    const requestId = crypto.randomUUID();

    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tally request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      socket.emit('tally:request', { requestId, xml: xmlPayload });
    });
  }
}

const socketServerInstance = new SocketServer();

export function initSocketServer(io: Server) {
  socketServerInstance.setIo(io);
}

export function getSocketServer(): SocketServer {
  return socketServerInstance;
}
