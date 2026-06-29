# Tally Prime → Node/Express → Supabase Integration
## Complete Implementation Guide

---

## HOW TALLY PRIME XML API WORKS

Tally Prime exposes a **built-in HTTP XML server** on port `9000` (default).
Your Node backend sends an XML request → Tally returns XML → you parse and store in Supabase.

```
[Tally Prime on Local Machine]
        ↕ HTTP XML (port 9000)
[Node/Express Backend]
        ↕ Supabase Client
[Supabase PostgreSQL]
        ↕ REST API
[Vite JSX/TSX Frontend]
```

> **Tally EDU version** supports the XML API fully for data reading.
> Write operations (voucher creation) may be restricted — reading is always available.

---

## STEP 1 — Enable Tally XML Server

1. Open **Tally Prime EDU**
2. Go to: `F12 (Configure)` → `Advanced Configuration`
3. Set:
   - **Enable ODBC Server**: Yes
   - **Port**: 9000
4. Alternatively via `Gateway of Tally` → `F12` → `Product & Features` → Enable **TallyPrime Server**
5. Tally must remain **open** while syncing

Test it works — open browser and visit:
```
http://localhost:9000
```
You should see a Tally XML response (even if empty).

---

## STEP 2 — .env Configuration

### Backend `.env`
```env
# Server
PORT=5000
NODE_ENV=development

# Tally Configuration
TALLY_HOST=localhost
TALLY_PORT=9000
TALLY_TIMEOUT=30000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Sync
SYNC_INTERVAL_MINUTES=30
```

### Frontend `.env`
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## STEP 3 — Supabase Tables (SQL)

Run these in your Supabase SQL Editor:

```sql
-- Companies fetched from Tally
CREATE TABLE tally_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL UNIQUE,
  formal_name TEXT,
  start_date DATE,
  end_date DATE,
  base_currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Accounts (Chart of Accounts)
CREATE TABLE tally_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL REFERENCES tally_companies(company_name) ON DELETE CASCADE,
  ledger_name TEXT NOT NULL,
  parent_group TEXT,
  closing_balance NUMERIC(18,2) DEFAULT 0,
  opening_balance NUMERIC(18,2) DEFAULT 0,
  is_debit BOOLEAN DEFAULT true,
  currency TEXT DEFAULT 'INR',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name, ledger_name)
);

-- Vouchers / Transactions
CREATE TABLE tally_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL REFERENCES tally_companies(company_name) ON DELETE CASCADE,
  voucher_number TEXT,
  voucher_type TEXT,
  voucher_date DATE,
  party_name TEXT,
  narration TEXT,
  amount NUMERIC(18,2),
  is_cancelled BOOLEAN DEFAULT false,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name, voucher_number, voucher_type)
);

-- Stock Items
CREATE TABLE tally_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL REFERENCES tally_companies(company_name) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  part_number TEXT,
  unit TEXT,
  closing_qty NUMERIC(18,4) DEFAULT 0,
  closing_rate NUMERIC(18,4) DEFAULT 0,
  closing_value NUMERIC(18,2) DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name, item_name)
);

-- Sync Log
CREATE TABLE tally_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  sync_type TEXT, -- 'companies', 'ledgers', 'vouchers', 'stock'
  status TEXT,    -- 'success', 'error', 'partial'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ledgers_company ON tally_ledgers(company_name);
CREATE INDEX idx_vouchers_company ON tally_vouchers(company_name);
CREATE INDEX idx_vouchers_date ON tally_vouchers(voucher_date);
CREATE INDEX idx_stock_company ON tally_stock_items(company_name);
```

---

## STEP 4 — Backend File Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── supabase.js
│   │   └── tally.js
│   ├── services/
│   │   ├── tallyXmlService.js      ← XML builder & HTTP caller
│   │   ├── tallyParserService.js   ← XML response parser
│   │   └── tallySyncService.js     ← Orchestrates full sync
│   ├── routes/
│   │   └── tally.routes.js
│   └── server.js
├── .env
└── package.json
```

---

## STEP 5 — Backend Code

### `src/config/tally.js`
```javascript
export const tallyConfig = {
  host: process.env.TALLY_HOST || 'localhost',
  port: parseInt(process.env.TALLY_PORT) || 9000,
  timeout: parseInt(process.env.TALLY_TIMEOUT) || 30000,
  get baseUrl() {
    return `http://${this.host}:${this.port}`;
  }
};
```

### `src/config/supabase.js`
```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Use service role for backend
);
```

---

### `src/services/tallyXmlService.js`
```javascript
import axios from 'axios';
import { tallyConfig } from '../config/tally.js';

// Send XML request to Tally and get XML back
export async function sendTallyRequest(xmlBody) {
  try {
    const response = await axios.post(tallyConfig.baseUrl, xmlBody, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: tallyConfig.timeout,
    });
    return { success: true, data: response.data };
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error('Tally is not running or XML server is disabled. Start Tally and enable the HTTP server on port ' + tallyConfig.port);
    }
    throw new Error('Tally request failed: ' + err.message);
  }
}

// ── XML REQUEST BUILDERS ──────────────────────────────────────────────

// Get list of all companies in Tally
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

// Get all ledgers for a specific company
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
            <FETCH>Name,Parent,ClosingBalance,OpeningBalance,IsBillwiseOn,CurrencyName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

// Get vouchers within a date range
export function buildVoucherXml(companyName, fromDate, toDate) {
  const from = fromDate || '20240401'; // Default: current FY start
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

// Get stock items
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

### `src/services/tallyParserService.js`
```javascript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '_',
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['COMPANY','LEDGER','VOUCHER','STOCKITEM'].includes(name),
});

function parseXml(xmlString) {
  return parser.parse(xmlString);
}

// Parse closing balance: Tally returns "1234.56 Dr" or "1234.56 Cr"
function parseBalance(val) {
  if (!val) return { amount: 0, isDebit: true };
  const str = String(val).trim();
  const isDebit = !str.includes('Cr');
  const amount = parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
  return { amount, isDebit };
}

// Parse Tally date format: 20240401 → Date
function parseTallyDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.length === 8) {
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  return null;
}

export function parseCompanies(xmlString) {
  const parsed = parseXml(xmlString);
  const envelope = parsed?.ENVELOPE;
  const body = envelope?.BODY?.DATA?.COLLECTION;
  if (!body) return [];

  const companies = Array.isArray(body.COMPANY) ? body.COMPANY : (body.COMPANY ? [body.COMPANY] : []);
  return companies.map(c => ({
    company_name: c.NAME || c._NAME || '',
    formal_name: c.FORMALNAME || c.NAME || '',
    start_date: parseTallyDate(c.STARTINGFROM),
    end_date: parseTallyDate(c.ENDINGAT),
    base_currency: c.BASECURRENCYNAME || 'INR',
  })).filter(c => c.company_name);
}

export function parseLedgers(xmlString, companyName) {
  const parsed = parseXml(xmlString);
  const body = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!body) return [];

  const ledgers = Array.isArray(body.LEDGER) ? body.LEDGER : (body.LEDGER ? [body.LEDGER] : []);
  return ledgers.map(l => {
    const closing = parseBalance(l.CLOSINGBALANCE);
    const opening = parseBalance(l.OPENINGBALANCE);
    return {
      company_name: companyName,
      ledger_name: l.NAME || '',
      parent_group: l.PARENT || '',
      closing_balance: closing.isDebit ? closing.amount : -closing.amount,
      opening_balance: opening.isDebit ? opening.amount : -opening.amount,
      is_debit: closing.isDebit,
      currency: l.CURRENCYNAME || 'INR',
    };
  }).filter(l => l.ledger_name);
}

export function parseVouchers(xmlString, companyName) {
  const parsed = parseXml(xmlString);
  const body = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!body) return [];

  const vouchers = Array.isArray(body.VOUCHER) ? body.VOUCHER : (body.VOUCHER ? [body.VOUCHER] : []);
  return vouchers.map(v => ({
    company_name: companyName,
    voucher_number: String(v.VOUCHERNUMBER || '').trim(),
    voucher_type: v.VOUCHERTYPENAME || '',
    voucher_date: parseTallyDate(v.DATE),
    party_name: v.PARTYLEDGERNAME || '',
    narration: v.NARRATION || '',
    amount: parseFloat(String(v.AMOUNT || '0').replace(/[^0-9.-]/g,'')) || 0,
    is_cancelled: v.ISCANCELLED === 'Yes',
    raw_data: v,
  })).filter(v => v.voucher_number);
}

export function parseStockItems(xmlString, companyName) {
  const parsed = parseXml(xmlString);
  const body = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!body) return [];

  const items = Array.isArray(body.STOCKITEM) ? body.STOCKITEM : (body.STOCKITEM ? [body.STOCKITEM] : []);
  return items.map(s => {
    const qty = parseBalance(s.CLOSINGBALANCE);
    return {
      company_name: companyName,
      item_name: s.NAME || '',
      part_number: s.PARTNO || '',
      unit: s.BASEUNITS || '',
      closing_qty: qty.amount,
      closing_rate: parseFloat(String(s.CLOSINGRATE || '0').replace(/[^0-9.-]/g,'')) || 0,
      closing_value: parseFloat(String(s.CLOSINGVALUE || '0').replace(/[^0-9.-]/g,'')) || 0,
    };
  }).filter(s => s.item_name);
}
```

---

### `src/services/tallySyncService.js`
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

async function logSync(companyName, syncType, status, count, error = null) {
  await supabase.from('tally_sync_log').insert({
    company_name: companyName,
    sync_type: syncType,
    status,
    records_synced: count,
    error_message: error,
    completed_at: new Date().toISOString(),
  });
}

// ── SYNC COMPANIES ────────────────────────────────────────────────────
export async function syncCompanies() {
  const xml = buildCompanyListXml();
  const { data: xmlData, success } = await sendTallyRequest(xml);
  if (!success) throw new Error('Failed to reach Tally');

  const companies = parseCompanies(xmlData);
  if (!companies.length) return { synced: 0, companies: [] };

  const rows = companies.map(c => ({
    ...c,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('tally_companies')
    .upsert(rows, { onConflict: 'company_name' });

  if (error) throw error;

  await logSync(null, 'companies', 'success', companies.length);
  return { synced: companies.length, companies };
}

// ── SYNC LEDGERS ─────────────────────────────────────────────────────
export async function syncLedgers(companyName) {
  const xml = buildLedgerXml(companyName);
  const { data: xmlData } = await sendTallyRequest(xml);
  const ledgers = parseLedgers(xmlData, companyName);

  if (!ledgers.length) {
    await logSync(companyName, 'ledgers', 'success', 0);
    return { synced: 0 };
  }

  const rows = ledgers.map(l => ({ ...l, last_synced_at: new Date().toISOString() }));

  // Batch upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('tally_ledgers')
      .upsert(chunk, { onConflict: 'company_name,ledger_name' });
    if (error) throw error;
  }

  await logSync(companyName, 'ledgers', 'success', ledgers.length);
  return { synced: ledgers.length };
}

// ── SYNC VOUCHERS ─────────────────────────────────────────────────────
export async function syncVouchers(companyName, fromDate, toDate) {
  const xml = buildVoucherXml(companyName, fromDate, toDate);
  const { data: xmlData } = await sendTallyRequest(xml);
  const vouchers = parseVouchers(xmlData, companyName);

  if (!vouchers.length) {
    await logSync(companyName, 'vouchers', 'success', 0);
    return { synced: 0 };
  }

  const rows = vouchers.map(v => ({ ...v, last_synced_at: new Date().toISOString() }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('tally_vouchers')
      .upsert(chunk, { onConflict: 'company_name,voucher_number,voucher_type' });
    if (error) throw error;
  }

  await logSync(companyName, 'vouchers', 'success', vouchers.length);
  return { synced: vouchers.length };
}

// ── SYNC STOCK ────────────────────────────────────────────────────────
export async function syncStock(companyName) {
  const xml = buildStockXml(companyName);
  const { data: xmlData } = await sendTallyRequest(xml);
  const items = parseStockItems(xmlData, companyName);

  if (!items.length) {
    await logSync(companyName, 'stock', 'success', 0);
    return { synced: 0 };
  }

  const rows = items.map(s => ({ ...s, last_synced_at: new Date().toISOString() }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('tally_stock_items')
      .upsert(chunk, { onConflict: 'company_name,item_name' });
    if (error) throw error;
  }

  await logSync(companyName, 'stock', 'success', items.length);
  return { synced: items.length };
}

// ── FULL SYNC (all data for a company) ───────────────────────────────
export async function fullSync(companyName, options = {}) {
  const results = {};
  const errors = [];

  try { results.ledgers = await syncLedgers(companyName); }
  catch (e) { errors.push({ type: 'ledgers', error: e.message }); }

  try { results.vouchers = await syncVouchers(companyName, options.fromDate, options.toDate); }
  catch (e) { errors.push({ type: 'vouchers', error: e.message }); }

  try { results.stock = await syncStock(companyName); }
  catch (e) { errors.push({ type: 'stock', error: e.message }); }

  return { results, errors };
}
```

---

### `src/routes/tally.routes.js`
```javascript
import express from 'express';
import { tallyConfig } from '../config/tally.js';
import { supabase } from '../config/supabase.js';
import { sendTallyRequest, buildCompanyListXml } from '../services/tallyXmlService.js';
import { syncCompanies, syncLedgers, syncVouchers, syncStock, fullSync } from '../services/tallySyncService.js';

const router = express.Router();

// ── TEST TALLY CONNECTION ─────────────────────────────────────────────
router.get('/ping', async (req, res) => {
  try {
    await sendTallyRequest(buildCompanyListXml());
    res.json({ connected: true, host: tallyConfig.host, port: tallyConfig.port });
  } catch (err) {
    res.status(503).json({ connected: false, error: err.message });
  }
});

// ── GET CONFIG ────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    host: process.env.TALLY_HOST,
    port: process.env.TALLY_PORT,
    timeout: process.env.TALLY_TIMEOUT,
  });
});

// ── SYNC COMPANIES ────────────────────────────────────────────────────
router.post('/sync/companies', async (req, res) => {
  try {
    const result = await syncCompanies();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SYNC FULL (single company) ────────────────────────────────────────
router.post('/sync/full', async (req, res) => {
  const { companyName, fromDate, toDate } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName is required' });

  try {
    const result = await fullSync(companyName, { fromDate, toDate });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SYNC INDIVIDUAL TYPES ─────────────────────────────────────────────
router.post('/sync/ledgers', async (req, res) => {
  const { companyName } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const result = await syncLedgers(companyName);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync/vouchers', async (req, res) => {
  const { companyName, fromDate, toDate } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const result = await syncVouchers(companyName, fromDate, toDate);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync/stock', async (req, res) => {
  const { companyName } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName required' });
  try {
    const result = await syncStock(companyName);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET DATA FROM SUPABASE ────────────────────────────────────────────
router.get('/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('tally_companies')
    .select('*')
    .eq('is_active', true)
    .order('company_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/ledgers', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param required' });
  const { data, error } = await supabase
    .from('tally_ledgers')
    .select('*')
    .eq('company_name', company)
    .order('ledger_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/vouchers', async (req, res) => {
  const { company, from, to, type } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param required' });
  let query = supabase
    .from('tally_vouchers')
    .select('*')
    .eq('company_name', company)
    .order('voucher_date', { ascending: false });
  if (from) query = query.gte('voucher_date', from);
  if (to) query = query.lte('voucher_date', to);
  if (type) query = query.eq('voucher_type', type);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/stock', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param required' });
  const { data, error } = await supabase
    .from('tally_stock_items')
    .select('*')
    .eq('company_name', company)
    .order('item_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/sync-log', async (req, res) => {
  const { company } = req.query;
  let query = supabase
    .from('tally_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50);
  if (company) query = query.eq('company_name', company);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
```

---

### `src/server.js`
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tallyRoutes from './routes/tally.routes.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/tally', tallyRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

### `package.json` (backend)
```json
{
  "name": "tally-sync-backend",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.x.x",
    "axios": "^1.x.x",
    "cors": "^2.x.x",
    "dotenv": "^16.x.x",
    "express": "^4.x.x",
    "fast-xml-parser": "^4.x.x"
  },
  "devDependencies": {
    "nodemon": "^3.x.x"
  }
}
```

Install: `npm install`

---

## STEP 6 — Frontend Code (Vite JSX/TSX)

### `src/hooks/useTally.ts`
```typescript
import { useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_BASE_URL;

export function useTally() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (url: string, options?: RequestInit) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}${url}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
```

---

### `src/context/CompanyContext.tsx`
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API = import.meta.env.VITE_API_BASE_URL;

interface Company {
  id: string;
  company_name: string;
  formal_name: string;
  base_currency: string;
  last_synced_at: string;
}

interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (c: Company) => void;
  refreshCompanies: () => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tally/companies`);
      const data = await res.json();
      setCompanies(data);
      if (!activeCompany && data.length > 0) setActiveCompany(data[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshCompanies(); }, []);

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompany, refreshCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be inside CompanyProvider');
  return ctx;
};
```

---

### `src/components/CompanySelector.tsx`
```typescript
import { useCompany } from '../context/CompanyContext';

export function CompanySelector() {
  const { companies, activeCompany, setActiveCompany, loading } = useCompany();

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600">Company:</label>
      <select
        className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
        value={activeCompany?.company_name || ''}
        onChange={(e) => {
          const found = companies.find(c => c.company_name === e.target.value);
          if (found) setActiveCompany(found);
        }}
      >
        {companies.map(c => (
          <option key={c.id} value={c.company_name}>
            {c.formal_name || c.company_name}
          </option>
        ))}
      </select>
      {activeCompany && (
        <span className="text-xs text-gray-400">
          Last synced: {activeCompany.last_synced_at
            ? new Date(activeCompany.last_synced_at).toLocaleString('en-IN')
            : 'Never'}
        </span>
      )}
    </div>
  );
}
```

---

### `src/components/TallySync.tsx`
```typescript
import { useState } from 'react';
import { useCompany } from '../context/CompanyContext';

const API = import.meta.env.VITE_API_BASE_URL;

interface SyncResult {
  type: string;
  synced?: number;
  error?: string;
}

export function TallySync() {
  const { activeCompany, refreshCompanies } = useCompany();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);

  const testConnection = async () => {
    try {
      const res = await fetch(`${API}/tally/ping`);
      const data = await res.json();
      setConnected(data.connected);
    } catch {
      setConnected(false);
    }
  };

  const syncCompanies = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/tally/sync/companies`, { method: 'POST' });
      const data = await res.json();
      await refreshCompanies();
      setResults([{ type: 'Companies', synced: data.synced }]);
      setStatus('success');
    } catch (e: any) {
      setResults([{ type: 'Companies', error: e.message }]);
      setStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const syncAll = async () => {
    if (!activeCompany) return;
    setSyncing(true);
    setResults([]);
    try {
      const res = await fetch(`${API}/tally/sync/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: activeCompany.company_name }),
      });
      const data = await res.json();
      const r: SyncResult[] = [
        { type: 'Ledgers', synced: data.results?.ledgers?.synced, error: data.errors?.find((e:any) => e.type === 'ledgers')?.error },
        { type: 'Vouchers', synced: data.results?.vouchers?.synced, error: data.errors?.find((e:any) => e.type === 'vouchers')?.error },
        { type: 'Stock Items', synced: data.results?.stock?.synced, error: data.errors?.find((e:any) => e.type === 'stock')?.error },
      ];
      setResults(r);
      setStatus(data.errors?.length ? 'error' : 'success');
      await refreshCompanies();
    } catch (e: any) {
      setStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold">Tally Sync</h2>

      {/* Connection Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={testConnection}
          className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
        >
          Test Connection
        </button>
        {connected === true && <span className="text-green-600 text-sm">● Tally Connected</span>}
        {connected === false && <span className="text-red-500 text-sm">● Tally Not Reachable — is it open on port 9000?</span>}
      </div>

      {/* Sync Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={syncCompanies}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {syncing ? 'Syncing...' : 'Sync Companies'}
        </button>
        <button
          onClick={syncAll}
          disabled={syncing || !activeCompany}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {syncing ? 'Syncing...' : `Sync All Data (${activeCompany?.company_name || '—'})`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map(r => (
            <div key={r.type} className={`text-sm flex items-center gap-2 ${r.error ? 'text-red-500' : 'text-green-600'}`}>
              <span>{r.error ? '✗' : '✓'}</span>
              <span>{r.type}: {r.error || `${r.synced} records synced`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### `src/pages/Dashboard.tsx`
```typescript
import { useCompany } from '../context/CompanyContext';
import { CompanySelector } from '../components/CompanySelector';
import { TallySync } from '../components/TallySync';
import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL;

export function Dashboard() {
  const { activeCompany } = useCompany();
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);

  useEffect(() => {
    if (!activeCompany) return;
    fetch(`${API}/tally/ledgers?company=${encodeURIComponent(activeCompany.company_name)}`)
      .then(r => r.json()).then(setLedgers);
    fetch(`${API}/tally/vouchers?company=${encodeURIComponent(activeCompany.company_name)}`)
      .then(r => r.json()).then(setVouchers);
  }, [activeCompany]);

  const totalAssets = ledgers
    .filter(l => ['Current Assets','Fixed Assets','Investments'].includes(l.parent_group) && l.is_debit)
    .reduce((s, l) => s + l.closing_balance, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <CompanySelector />
      </div>

      {/* Sync Panel */}
      <TallySync />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Ledgers</p>
          <p className="text-3xl font-bold mt-1">{ledgers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Vouchers</p>
          <p className="text-3xl font-bold mt-1">{vouchers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-3xl font-bold mt-1">₹{totalAssets.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b font-semibold">Ledgers — {activeCompany?.company_name}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Ledger Name</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3 text-right">Closing Balance</th>
                <th className="px-4 py-3 text-center">Dr/Cr</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map(l => (
                <tr key={l.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{l.ledger_name}</td>
                  <td className="px-4 py-3 text-gray-500">{l.parent_group}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₹{Math.abs(l.closing_balance).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${l.is_debit ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {l.is_debit ? 'Dr' : 'Cr'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

---

### `src/main.tsx`
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CompanyProvider } from './context/CompanyContext';
import { Dashboard } from './pages/Dashboard';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanyProvider>
      <Dashboard />
    </CompanyProvider>
  </StrictMode>
);
```

---

## STEP 7 — Complete Workflow

```
1. npm install          ← install backend deps
2. Configure .env       ← set TALLY_HOST, PORT, Supabase keys
3. Run Supabase SQL     ← create all tables
4. Open Tally Prime     ← enable XML server on port 9000
5. npm run dev          ← start Express backend
6. npm run dev          ← start Vite frontend
7. Dashboard → Test Connection → Sync Companies → Sync All Data
```

---

## STEP 8 — Troubleshooting

| Issue | Fix |
|---|---|
| `ECONNREFUSED localhost:9000` | Tally not running / XML server not enabled |
| Empty company list | Tally has no open company — open one first |
| XML parse error | Tally EDU sometimes returns partial XML for large datasets — reduce date range |
| Supabase upsert fails | Check RLS policies — disable or add service role bypass |
| `CORS error` on frontend | Set `FRONTEND_URL` in backend `.env` to your Vite dev URL |

---

## STEP 9 — Optional: Auto-Sync (Cron)

Add to `server.js`:
```javascript
import cron from 'node-cron';
import { syncCompanies, fullSync } from './services/tallySyncService.js';

// Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Starting Tally sync...');
  const { companies } = await syncCompanies();
  for (const company of companies) {
    await fullSync(company.company_name);
  }
  console.log('[CRON] Sync complete');
});
```

Install: `npm install node-cron`