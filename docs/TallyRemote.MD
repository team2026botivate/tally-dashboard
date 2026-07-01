# Tally Remote Fetch — Multi-User via IP
## Hosted Backend Integration Guide

---

## THE CORE CHALLENGE

When your backend is **hosted on a cloud server** (Render, Railway, VPS, etc.) and your
users have **Tally Prime running on their local office/home machines**, the backend
cannot reach `localhost:9000` — it must reach the user's **public IP and forwarded port**.

Each user needs to:
1. Know their **public IP address**
2. **Forward port 9000** on their router to their local machine (OR use an ngrok tunnel)
3. Enter these details into your dashboard

Your backend stores this config per user and uses it when syncing.

---

## ARCHITECTURE

```
[User A — 103.x.x.x]          [User B — 182.x.x.x]
  Tally Prime :9000               Tally Prime :9000
        |                               |
        └──────── HTTP XML ─────────────┘
                       |
              [Your Hosted Backend]
              Node/Express on cloud
              Reads tally_connections table
              Fetches from each user's IP:port
                       |
                   [Supabase]
              tally_connections (config)
              tally_companies
              tally_ledgers
              tally_vouchers
                       |
              [Vite Frontend]
              Dashboard with company switcher
```

---

## TWO METHODS FOR CONNECTIVITY

### Method A — Port Forwarding (Production use)

The user's router forwards external port 9000 → their local machine's IP:9000.

**Pros**: Free, always-on, no extra software
**Cons**: User must configure their router (most can do this)

Steps the user follows:
1. Find their router admin panel (usually `192.168.1.1`)
2. Add a port forward rule: External port `9000` → Internal IP of their machine → Port `9000`
3. Find their public IP at [whatismyip.com](https://whatismyip.com)
4. Enter public IP + port `9000` in your dashboard

---

### Method B — ngrok Tunnel (Easiest, zero router config)

User installs ngrok on their machine, runs one command, gets a public URL.

**Pros**: Works behind any NAT, no router access needed, works on dynamic IPs
**Cons**: Free plan URL changes on restart (paid plan gives fixed URLs)

```bash
# User installs ngrok (https://ngrok.com)
ngrok tcp 9000
# Output: tcp://0.tcp.ngrok.io:12345 → localhost:9000
```

User enters `0.tcp.ngrok.io` as host and `12345` as port in your dashboard.

**For permanent setups** → user gets a paid ngrok plan and sets a fixed TCP address.

---

## STEP 1 — Supabase: Add `tally_connections` Table

Run this in your Supabase SQL Editor:

```sql
-- One row per user's Tally connection config
CREATE TABLE tally_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,               -- e.g. "Office Machine", "Home Server"
  host          TEXT NOT NULL,               -- public IP or ngrok hostname
  port          INTEGER NOT NULL DEFAULT 9000,
  method        TEXT NOT NULL DEFAULT 'ip',  -- 'ip' | 'ngrok'
  api_token     TEXT,                        -- optional shared secret for your own auth layer
  is_active     BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_ok  BOOLEAN,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Each user can only see their own connections
ALTER TABLE tally_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own connections"
  ON tally_connections FOR ALL
  USING (auth.uid() = user_id);

-- Service role (backend) bypasses RLS automatically
-- Index for fast lookup
CREATE INDEX idx_tally_connections_user ON tally_connections(user_id);

-- Add connection_id FK to all tally data tables
ALTER TABLE tally_companies  ADD COLUMN connection_id UUID REFERENCES tally_connections(id) ON DELETE CASCADE;
ALTER TABLE tally_ledgers    ADD COLUMN connection_id UUID REFERENCES tally_connections(id) ON DELETE CASCADE;
ALTER TABLE tally_vouchers   ADD COLUMN connection_id UUID REFERENCES tally_connections(id) ON DELETE CASCADE;
ALTER TABLE tally_stock_items ADD COLUMN connection_id UUID REFERENCES tally_connections(id) ON DELETE CASCADE;
```

---

## STEP 2 — Backend: `.env`

```env
# Server
PORT=5000
NODE_ENV=production

# Supabase (service role — used only on backend, never exposed to frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security: sign requests so users can't forge syncs
SYNC_SECRET=any-long-random-string-you-generate

# Tally request timeout (ms) — increase for slow connections
TALLY_TIMEOUT=45000

# Optional: max concurrent syncs
MAX_CONCURRENT_SYNCS=3
```

The `TALLY_HOST` and `TALLY_PORT` are now **not in .env** — they come from each user's
row in `tally_connections` instead.

---

## STEP 3 — Backend File Structure (additions)

```
backend/src/
├── config/
│   └── supabase.js              (existing)
├── services/
│   ├── tallyXmlService.js       (existing — modify sendTallyRequest)
│   ├── tallyParserService.js    (existing — no change)
│   ├── tallySyncService.js      (existing — modify to accept connectionConfig)
│   └── tallyConnectionService.js  ← NEW
├── routes/
│   ├── tally.routes.js          (existing)
│   └── tallyConnection.routes.js  ← NEW
└── server.js
```

---

## STEP 4 — Modified `tallyXmlService.js` (accepts dynamic host/port)

```javascript
import axios from 'axios';

// Now accepts a connection config object instead of using global tallyConfig
export async function sendTallyRequest(xmlBody, connectionConfig) {
  const { host, port } = connectionConfig;
  const url = `http://${host}:${port}`;
  const timeout = parseInt(process.env.TALLY_TIMEOUT) || 45000;

  try {
    const response = await axios.post(url, xmlBody, {
      headers: { 'Content-Type': 'text/xml' },
      timeout,
    });
    return { success: true, data: response.data };
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Cannot reach Tally at ${host}:${port} — is Tally open and port forwarded?`);
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      throw new Error(`Connection to ${host}:${port} timed out — check port forwarding or ngrok tunnel`);
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Host not found: ${host} — check the hostname is correct`);
    }
    throw new Error(`Tally request failed: ${err.message}`);
  }
}

// Test if a connection is reachable (lightweight ping)
export async function pingTallyConnection(connectionConfig) {
  const { host, port } = connectionConfig;
  const url = `http://${host}:${port}`;
  try {
    await axios.post(url, buildPingXml(), {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 8000,
    });
    return { reachable: true };
  } catch (err) {
    return {
      reachable: false,
      reason: err.code === 'ECONNREFUSED' ? 'Tally not running or port closed'
             : err.code === 'ETIMEDOUT'   ? 'Host reachable but port not responding'
             : err.code === 'ENOTFOUND'   ? 'Hostname not found'
             : err.message,
    };
  }
}

function buildPingXml() {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Companies" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>Name</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

// All XML builders now accept companyName and connection config is passed separately
export function buildCompanyListXml() {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Companies" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>Name,StartingFrom,EndingAt,FormalName,BaseCurrencyName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

export function buildLedgerXml(companyName) {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="List of Ledgers" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,ClosingBalance,OpeningBalance,CurrencyName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

export function buildVoucherXml(companyName, fromDate, toDate) {
  const from = fromDate || '20240401';
  const to = toDate || new Date().toISOString().slice(0,10).replace(/-/g,'');
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Voucher Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVFROMDATE>${from}</SVFROMDATE>
        <SVTODATE>${to}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Voucher Collection" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>VoucherNumber,VoucherTypeName,Date,PartyLedgerName,Narration,Amount,IsCancelled</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

export function buildStockXml(companyName) {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Stock Items</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Stock Items" ISMODIFY="No">
            <TYPE>Stock Item</TYPE>
            <FETCH>Name,PartNo,BaseUnits,ClosingBalance,ClosingRate,ClosingValue</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}
```

---

## STEP 5 — NEW `tallyConnectionService.js`

```javascript
import { supabase } from '../config/supabase.js';

// Get a single connection config for a user (used before every sync)
export async function getConnectionConfig(connectionId, userId) {
  const { data, error } = await supabase
    .from('tally_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)   // ensures user can only sync their own connection
    .single();

  if (error || !data) throw new Error('Connection not found or access denied');
  if (!data.is_active) throw new Error('This connection is disabled');
  return data;
}

// List all connections for a user
export async function listUserConnections(userId) {
  const { data, error } = await supabase
    .from('tally_connections')
    .select('id,label,host,port,method,is_active,last_tested_at,last_test_ok,created_at')
    .eq('user_id', userId)
    .order('created_at');

  if (error) throw error;
  return data;
}

// Create a new connection config
export async function createConnection(userId, { label, host, port, method, api_token }) {
  // Sanitise host — strip protocols if user pastes a full URL
  const cleanHost = host
    .replace(/^https?:\/\//i, '')
    .replace(/^tcp:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();

  const { data, error } = await supabase
    .from('tally_connections')
    .insert({ user_id: userId, label, host: cleanHost, port: parseInt(port), method, api_token })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update an existing connection
export async function updateConnection(connectionId, userId, updates) {
  const allowed = ['label','host','port','method','api_token','is_active'];
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );
  if (safe.host) {
    safe.host = safe.host.replace(/^https?:\/\//i,'').replace(/^tcp:\/\//i,'').replace(/\/.*$/,'').trim();
  }
  safe.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('tally_connections')
    .update(safe)
    .eq('id', connectionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a connection (cascades to all tally data for this connection)
export async function deleteConnection(connectionId, userId) {
  const { error } = await supabase
    .from('tally_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Record test result
export async function recordTestResult(connectionId, ok) {
  await supabase
    .from('tally_connections')
    .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
    .eq('id', connectionId);
}
```

---

## STEP 6 — Modified `tallySyncService.js`

```javascript
import { supabase } from '../config/supabase.js';
import {
  sendTallyRequest,
  buildCompanyListXml,
  buildLedgerXml,
  buildVoucherXml,
  buildStockXml,
} from './tallyXmlService.js';
import {
  parseCompanies,
  parseLedgers,
  parseVouchers,
  parseStockItems,
} from './tallyParserService.js';

async function logSync(connectionId, userId, syncType, status, count, error = null) {
  await supabase.from('tally_sync_log').insert({
    connection_id: connectionId,
    user_id: userId,
    sync_type: syncType,
    status,
    records_synced: count,
    error_message: error,
    completed_at: new Date().toISOString(),
  });
}

// connectionConfig = { id, host, port, user_id, ... }

export async function syncCompanies(connectionConfig) {
  const xml = buildCompanyListXml();
  const { data: xmlData } = await sendTallyRequest(xml, connectionConfig);
  const companies = parseCompanies(xmlData);

  if (!companies.length) return { synced: 0, companies: [] };

  const rows = companies.map(c => ({
    ...c,
    connection_id: connectionConfig.id,
    user_id: connectionConfig.user_id,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('tally_companies')
    .upsert(rows, { onConflict: 'connection_id,company_name' });

  if (error) throw error;
  await logSync(connectionConfig.id, connectionConfig.user_id, 'companies', 'success', companies.length);
  return { synced: companies.length, companies };
}

export async function syncLedgers(connectionConfig, companyName) {
  const xml = buildLedgerXml(companyName);
  const { data: xmlData } = await sendTallyRequest(xml, connectionConfig);
  const ledgers = parseLedgers(xmlData, companyName);

  if (!ledgers.length) return { synced: 0 };

  const rows = ledgers.map(l => ({
    ...l,
    connection_id: connectionConfig.id,
    user_id: connectionConfig.user_id,
    last_synced_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('tally_ledgers')
      .upsert(rows.slice(i, i + 500), { onConflict: 'connection_id,company_name,ledger_name' });
    if (error) throw error;
  }

  await logSync(connectionConfig.id, connectionConfig.user_id, 'ledgers', 'success', ledgers.length);
  return { synced: ledgers.length };
}

export async function syncVouchers(connectionConfig, companyName, fromDate, toDate) {
  const xml = buildVoucherXml(companyName, fromDate, toDate);
  const { data: xmlData } = await sendTallyRequest(xml, connectionConfig);
  const vouchers = parseVouchers(xmlData, companyName);

  if (!vouchers.length) return { synced: 0 };

  const rows = vouchers.map(v => ({
    ...v,
    connection_id: connectionConfig.id,
    user_id: connectionConfig.user_id,
    last_synced_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('tally_vouchers')
      .upsert(rows.slice(i, i + 500), { onConflict: 'connection_id,company_name,voucher_number,voucher_type' });
    if (error) throw error;
  }

  await logSync(connectionConfig.id, connectionConfig.user_id, 'vouchers', 'success', vouchers.length);
  return { synced: vouchers.length };
}

export async function syncStock(connectionConfig, companyName) {
  const xml = buildStockXml(companyName);
  const { data: xmlData } = await sendTallyRequest(xml, connectionConfig);
  const items = parseStockItems(xmlData, companyName);

  if (!items.length) return { synced: 0 };

  const rows = items.map(s => ({
    ...s,
    connection_id: connectionConfig.id,
    user_id: connectionConfig.user_id,
    last_synced_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('tally_stock_items')
      .upsert(rows.slice(i, i + 500), { onConflict: 'connection_id,company_name,item_name' });
    if (error) throw error;
  }

  await logSync(connectionConfig.id, connectionConfig.user_id, 'stock', 'success', items.length);
  return { synced: items.length };
}

export async function fullSync(connectionConfig, companyName, options = {}) {
  const results = {};
  const errors = [];

  try { results.companies = await syncCompanies(connectionConfig); }
  catch (e) { errors.push({ type: 'companies', error: e.message }); }

  try { results.ledgers = await syncLedgers(connectionConfig, companyName); }
  catch (e) { errors.push({ type: 'ledgers', error: e.message }); }

  try { results.vouchers = await syncVouchers(connectionConfig, companyName, options.fromDate, options.toDate); }
  catch (e) { errors.push({ type: 'vouchers', error: e.message }); }

  try { results.stock = await syncStock(connectionConfig, companyName); }
  catch (e) { errors.push({ type: 'stock', error: e.message }); }

  return { results, errors };
}
```

---

## STEP 7 — NEW `tallyConnection.routes.js`

```javascript
import express from 'express';
import { supabase } from '../config/supabase.js';
import {
  listUserConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  getConnectionConfig,
  recordTestResult,
} from '../services/tallyConnectionService.js';
import { pingTallyConnection } from '../services/tallyXmlService.js';
import { syncCompanies, fullSync } from '../services/tallySyncService.js';

const router = express.Router();

// ── Auth middleware: get user from Supabase JWT ───────────────────────
async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// ── LIST connections ──────────────────────────────────────────────────
router.get('/', requireUser, async (req, res) => {
  try {
    const connections = await listUserConnections(req.user.id);
    res.json(connections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CREATE connection ─────────────────────────────────────────────────
router.post('/', requireUser, async (req, res) => {
  const { label, host, port, method, api_token } = req.body;
  if (!label || !host || !port) {
    return res.status(400).json({ error: 'label, host, and port are required' });
  }
  try {
    const conn = await createConnection(req.user.id, { label, host, port, method, api_token });
    res.status(201).json(conn);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── UPDATE connection ─────────────────────────────────────────────────
router.patch('/:id', requireUser, async (req, res) => {
  try {
    const conn = await updateConnection(req.params.id, req.user.id, req.body);
    res.json(conn);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE connection ─────────────────────────────────────────────────
router.delete('/:id', requireUser, async (req, res) => {
  try {
    await deleteConnection(req.params.id, req.user.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TEST connection (ping Tally) ──────────────────────────────────────
router.post('/:id/test', requireUser, async (req, res) => {
  try {
    const config = await getConnectionConfig(req.params.id, req.user.id);
    const result = await pingTallyConnection(config);
    await recordTestResult(req.params.id, result.reachable);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SYNC companies (discover all companies in Tally) ──────────────────
router.post('/:id/sync/companies', requireUser, async (req, res) => {
  try {
    const config = await getConnectionConfig(req.params.id, req.user.id);
    const result = await syncCompanies(config);
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── SYNC full (all data for one company) ──────────────────────────────
router.post('/:id/sync/full', requireUser, async (req, res) => {
  const { companyName, fromDate, toDate } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName is required' });
  try {
    const config = await getConnectionConfig(req.params.id, req.user.id);
    const result = await fullSync(config, companyName, { fromDate, toDate });
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
```

---

## STEP 8 — Register the new route in `server.js`

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tallyRoutes from './routes/tally.routes.js';
import tallyConnectionRoutes from './routes/tallyConnection.routes.js';  // ADD

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/tally', tallyRoutes);
app.use('/api/tally/connections', tallyConnectionRoutes);  // ADD

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(process.env.PORT || 5000);
```

---

## STEP 9 — Frontend: Connection Manager Component

### `src/components/TallyConnectionManager.tsx`

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_BASE_URL;

interface Connection {
  id: string;
  label: string;
  host: string;
  port: number;
  method: string;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
}

export function TallyConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', host: '', port: '9000', method: 'ip' });

  const load = async () => {
    const headers = await authHeaders();
    const res = await fetch(`${API}/tally/connections`, { headers });
    setConnections(await res.json());
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const headers = await authHeaders();
    await fetch(`${API}/tally/connections`, {
      method: 'POST', headers,
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ label: '', host: '', port: '9000', method: 'ip' });
    load();
  };

  const test = async (id: string) => {
    setTesting(id);
    const headers = await authHeaders();
    const res = await fetch(`${API}/tally/connections/${id}/test`, { method: 'POST', headers });
    const data = await res.json();
    alert(data.reachable ? '✅ Tally is reachable!' : `❌ Not reachable: ${data.reason}`);
    setTesting(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this connection? All synced data for it will also be removed.')) return;
    const headers = await authHeaders();
    await fetch(`${API}/tally/connections/${id}`, { method: 'DELETE', headers });
    load();
  };

  const syncCompanies = async (id: string) => {
    const headers = await authHeaders();
    const res = await fetch(`${API}/tally/connections/${id}/sync/companies`, { method: 'POST', headers });
    const data = await res.json();
    alert(data.success ? `✅ Found ${data.synced} companies` : `❌ ${data.error}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tally Connections</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          + Add Connection
        </button>
      </div>

      {/* Add Connection Form */}
      {showForm && (
        <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50">
          <h3 className="font-medium">New Tally Connection</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Label (e.g. "Office PC")</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Office machine"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Connection Method</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm bg-white"
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              >
                <option value="ip">Public IP + Port Forward</option>
                <option value="ngrok">ngrok Tunnel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {form.method === 'ngrok' ? 'ngrok Hostname (e.g. 0.tcp.ngrok.io)' : 'Public IP Address'}
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={form.host}
                onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                placeholder={form.method === 'ngrok' ? '0.tcp.ngrok.io' : '103.x.x.x'}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Port</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={form.port}
                onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                placeholder="9000"
              />
            </div>
          </div>

          {form.method === 'ip' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-3">
              Make sure your router is forwarding external port {form.port} to your local
              machine's IP. Visit <strong>whatismyip.com</strong> to find your public IP.
            </p>
          )}
          {form.method === 'ngrok' && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded p-3">
              Run <code className="bg-blue-100 px-1 rounded">ngrok tcp 9000</code> on the
              machine where Tally is open. Copy the hostname and port from the ngrok output.
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={save} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm">
              Save Connection
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connection List */}
      {connections.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">No connections yet. Add one to start syncing.</p>
      )}

      {connections.map(c => (
        <div key={c.id} className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.last_test_ok === true  ? 'bg-green-100 text-green-700' :
                  c.last_test_ok === false ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {c.last_test_ok === true ? 'Online' : c.last_test_ok === false ? 'Offline' : 'Untested'}
                </span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                  {c.method}
                </span>
              </div>
              <p className="text-sm text-gray-500 font-mono mt-1">{c.host}:{c.port}</p>
              {c.last_tested_at && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Last tested: {new Date(c.last_tested_at).toLocaleString('en-IN')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => test(c.id)}
                disabled={testing === c.id}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {testing === c.id ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={() => syncCompanies(c.id)}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                Fetch Companies
              </button>
              <button
                onClick={() => remove(c.id)}
                className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## STEP 10 — User Instructions (what to tell your users)

Give each user this checklist:

### If using Port Forwarding (Method A)

```
1. Open Tally Prime → F12 → Advanced Configuration
   → Enable ODBC Server: Yes → Port: 9000

2. Find your local machine IP:
   Windows: run cmd → ipconfig → look for IPv4 Address (e.g. 192.168.1.105)

3. Open your router admin panel (usually http://192.168.1.1)
   → Port Forwarding section
   → Add rule: External port 9000 → Internal IP 192.168.1.105 → Port 9000

4. Find your public IP: visit https://whatismyip.com

5. In the dashboard:
   → Add Connection → choose "Public IP"
   → Host: your public IP (from step 4)
   → Port: 9000
   → Click Test to verify
```

### If using ngrok (Method B — simpler)

```
1. Open Tally Prime → F12 → Advanced Configuration
   → Enable ODBC Server: Yes → Port: 9000

2. Download ngrok from https://ngrok.com/download
   Create a free account and get your authtoken

3. In terminal/cmd:
   ngrok config add-authtoken YOUR_TOKEN
   ngrok tcp 9000

4. ngrok will show:
   Forwarding tcp://0.tcp.ngrok.io:XXXXX -> localhost:9000

5. In the dashboard:
   → Add Connection → choose "ngrok"
   → Host: 0.tcp.ngrok.io
   → Port: XXXXX (the number from step 4)
   → Click Test to verify

Note: Free ngrok port changes each time you restart it.
For a permanent port, upgrade to a paid ngrok plan.
```

---

## STEP 11 — Security Checklist

| Risk | Mitigation |
|---|---|
| Unauthorised sync requests | `requireUser` middleware validates Supabase JWT on every route |
| User accessing another user's data | `user_id` filter on every DB query + Supabase RLS |
| Tally port exposed to the internet | Tell users to whitelist only your backend server IP in their router/firewall |
| ngrok URL guessable | ngrok URLs are random; add an `api_token` field for extra verification if needed |
| SQL injection in company names | Parameterised queries via Supabase JS client; XML uses template literals but Tally validates it |

### Optional: IP Allowlisting in Tally

In Tally Prime's gateway, there is no built-in IP whitelist. Use the router/firewall to restrict who can reach port 9000. Users can add a firewall rule allowing only your hosted server's IP through.

---

## COMPLETE API REFERENCE

```
GET    /api/tally/connections              → list user's connections
POST   /api/tally/connections              → create connection
PATCH  /api/tally/connections/:id          → update connection
DELETE /api/tally/connections/:id          → delete connection
POST   /api/tally/connections/:id/test     → ping Tally at that IP
POST   /api/tally/connections/:id/sync/companies  → fetch company list
POST   /api/tally/connections/:id/sync/full       → full sync (body: { companyName, fromDate?, toDate? })
```

---

## QUICK TROUBLESHOOTING

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED` | Tally not running | Open Tally Prime first |
| `ETIMEDOUT` | Port not forwarded | Check router port forward rule |
| `ENOTFOUND` | Wrong hostname | Verify ngrok hostname or public IP |
| `Connection not found` | Wrong connection ID or wrong user | Re-login and try again |
| Tally returns empty XML | Company not open in Tally | Open a company in Tally first |
| ngrok port keeps changing | Free plan | Upgrade ngrok or script auto-update |