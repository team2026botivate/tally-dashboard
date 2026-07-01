import { Server, Socket } from 'socket.io';
import { prisma } from '../database/prismaClient.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface PendingRequest {
  resolve: (xml: string) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
}

export class SocketServer {
  private static instance: SocketServer;
  private io: Server | null = null;
  private activeConnections = new Map<string, Socket>();
  private pendingRequests = new Map<string, PendingRequest>();

  private constructor() {}

  public static getInstance(): SocketServer {
    if (!SocketServer.instance) {
      SocketServer.instance = new SocketServer();
    }
    return SocketServer.instance;
  }

  public init(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true
      },
      pingInterval: 10000,
      pingTimeout: 5000
    });

    // Authentication middleware
    this.io.use(async (socket: Socket, next: (err?: Error) => void) => {
      const gatewayId = socket.handshake.auth.gatewayId;
      const deviceSecret = socket.handshake.auth.deviceSecret;

      if (!gatewayId || !deviceSecret) {
        return next(new Error('Authentication failed: Missing gatewayId or deviceSecret'));
      }

      try {
        const config = await prisma.tallyConfiguration.findUnique({
          where: { gatewayId }
        });

        if (!config || !config.deviceSecretHash) {
          return next(new Error('Authentication failed: Gateway not found or unconfigured'));
        }

        const isMatch = await bcrypt.compare(deviceSecret, config.deviceSecretHash);
        if (!isMatch) {
          return next(new Error('Authentication failed: Invalid credentials'));
        }

        // Attach configuration data to socket
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

      // Handle duplicate connections: disconnect older socket
      const existingSocket = this.activeConnections.get(gatewayId);
      if (existingSocket) {
        console.log(`[SocketServer] Disconnecting duplicate socket for: ${gatewayId}`);
        existingSocket.disconnect();
      }

      this.activeConnections.set(gatewayId, socket);
      this.updateGatewayStatus(configId, 'ONLINE');

      // Heartbeat event from client agent
      socket.on('tally:heartbeat', async (data: { deviceInfo: any }) => {
        try {
          await prisma.tallyConfiguration.update({
            where: { id: configId },
            data: {
              status: 'ONLINE',
              lastHeartbeatAt: new Date(),
              deviceInfo: data.deviceInfo || {}
            }
          });
        } catch (err: any) {
          console.error(`[SocketServer] Heartbeat update error for ${gatewayId}:`, err.message);
        }
      });

      // Response received from client agent
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
        // Only clear if this is the active socket reference
        if (this.activeConnections.get(gatewayId) === socket) {
          this.activeConnections.delete(gatewayId);
          this.updateGatewayStatus(configId, 'OFFLINE');
        }
      });
    });
  }

  private async updateGatewayStatus(configId: string, status: string) {
    try {
      await prisma.tallyConfiguration.update({
        where: { id: configId },
        data: { status }
      });
    } catch (err: any) {
      console.error(`[SocketServer] Status update error for config ${configId}:`, err.message);
    }
  }

  public isOnline(gatewayId: string): boolean {
    return this.activeConnections.has(gatewayId);
  }

  public async sendRequest(gatewayId: string, xmlPayload: string, timeoutMs = 45000): Promise<string> {
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
