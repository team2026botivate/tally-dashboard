import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initSocketServer } from './socket-handler.js';
import { initCron } from './cron.js';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;
const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Proxy endpoint: Next.js calls this to relay XML requests to agents
app.post('/api/agent/request', async (req, res) => {
  try {
    const { gatewayId, xml } = req.body;
    if (!gatewayId || !xml) {
      return res.status(400).json({ error: 'gatewayId and xml are required' });
    }
    const socketServer = (await import('./socket-handler.js')).getSocketServer();
    const responseXml = await socketServer.sendRequest(gatewayId, xml);
    res.json({ xml: responseXml });
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-server', timestamp: new Date().toISOString() });
});

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

initSocketServer(io);
initCron(NEXTJS_URL);

server.listen(PORT, () => {
  console.log(`Agent server running on port ${PORT}`);
  console.log(`Forwarding sync requests to Next.js at ${NEXTJS_URL}`);
});
