import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../services/database/prismaClient.js';

const router = Router();

// Helper: fetch companies from Tally at given host:port
async function fetchTallyCompanies(host: string, port: number): Promise<string[]> {
  const xml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyList</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanyList" ISINITIALIZE="No" ISFIXLIST="No">
            <TYPE>Company</TYPE>
            <FETCH>NAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  const response = await axios.post(`http://${host}:${port}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
    timeout: 15000
  });
  const nameRegex = /<NAME\s*(?:[^>]*)>([^<]+)<\/NAME>/gi;
  const names: string[] = [];
  let match;
  while ((match = nameRegex.exec(response.data)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

// GET /api/config - get active config
router.get('/', async (req, res) => {
  try {
    const config = await prisma.tallyConfiguration.findFirst({
      where: { isActive: true }
    });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/all - get all configs
router.get('/all', async (req, res) => {
  try {
    const configs = await prisma.tallyConfiguration.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/config - create config(s) from host + port only (auto-fetch companies)
router.post('/', async (req, res) => {
  try {
    const { host, port, syncInterval } = req.body;
    if (!host || !port) {
      return res.status(400).json({ error: 'Host and port are required' });
    }

    // Fetch companies from Tally
    const companyNames = await fetchTallyCompanies(host, Number(port));
    if (companyNames.length === 0) {
      return res.status(404).json({ error: 'No companies found on Tally at ' + host + ':' + port });
    }

    // Deactivate all existing configs
    await prisma.tallyConfiguration.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create/update one config per company
    const created: any[] = [];
    for (let i = 0; i < companyNames.length; i++) {
      const companyName = companyNames[i];
      const existing = await prisma.tallyConfiguration.findFirst({ where: { companyName, host, port } });
      if (existing) {
        const updated = await prisma.tallyConfiguration.update({
          where: { id: existing.id },
          data: { host, port, syncInterval, isActive: i === 0 }
        });
        created.push(updated);
      } else {
        const newConfig = await prisma.tallyConfiguration.create({
          data: { host, port, companyName, syncInterval, isActive: i === 0 }
        });
        created.push(newConfig);
      }
    }

    res.status(201).json({ configs: created, companies: companyNames });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/config/:id - update a config
router.put('/:id', async (req, res) => {
  try {
    const { host, port, companyName, authToken, syncInterval } = req.body;
    const config = await prisma.tallyConfiguration.update({
      where: { id: req.params.id },
      data: { host, port, companyName, authToken, syncInterval }
    });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/config/:id/activate - activate a config, deactivate others
router.post('/:id/activate', async (req, res) => {
  try {
    const configId = req.params.id;

    // Deactivate all configs
    await prisma.tallyConfiguration.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Activate the selected config
    const config = await prisma.tallyConfiguration.update({
      where: { id: configId },
      data: { isActive: true }
    });

    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/config/:id - soft delete a config
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tallyConfiguration.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
