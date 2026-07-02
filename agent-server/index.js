require('dotenv').config();
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, 'agent-config.json');
const CLOUD_URL = process.env.CLOUD_URL || 'http://localhost:3000';
const TALLY_HOST = process.env.TALLY_HOST || 'localhost';
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10);
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '300000', 10); // 5 min
const VOUCHER_CHUNK_DAYS = 90;

// Max number of Tally/cloud requests allowed in flight at once.
// Tally's local HTTP interface serializes requests internally, so pushing
// this too high just causes queuing/timeouts rather than real speedup.
// Tune via env var; running locally with good hardware you can likely go
// higher than the default, but watch for ECONNRESET / timeout errors.
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);

// ─── State ───────────────────────────────────────────────────────────────────

let config = loadConfig();
let running = true;

// ─── XML Parser ──────────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  isArray: (tagName) =>
    ['LEDGER', 'GROUP', 'STOCKGROUP', 'STOCKITEM', 'VOUCHER',
      'LEDGERENTRY', 'TALLYMESSAGE', 'COLLECTION', 'ADDRESS',
      'LINE', 'COMPANY'].includes(tagName.toUpperCase())
});

// ─── Concurrency Helper ──────────────────────────────────────────────────────

/**
 * Runs `worker` over `items` with at most `limit` running concurrently.
 * Simple dependency-free replacement for p-limit / p-map.
 */
async function pMap(items, worker, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(cfg) {
  config = { ...config, ...cfg };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Tally XML Requests ──────────────────────────────────────────────────────

function buildCompanyXml() {
  return `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanyList" ISINITIALIZE="No" ISFIXLIST="No">
            <TYPE>Company</TYPE>
            <FETCH>NAME, GUID</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function buildMasterXml(reportName, companyName) {
  const escapedCompany = escapeXml(companyName);
  const companyVar = escapedCompany ? `<SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>` : '';
  const staticVars = `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyVar}`;

  const templates = {
    LedgerList: `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>LedgerList</ID></HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>${staticVars}</STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="LedgerList" ISINITIALIZE="No" ISFIXLIST="No" ISALTER="No">
            <TYPE>Group</TYPE>
            <FETCH>NAME, PARENT, LEDGERS, GROUPS</FETCH>
            <CHILDOF>$$Root</CHILDOF>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`,

    StockGroupList: `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>StockGroupList</ID></HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>${staticVars}</STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockGroupList" ISINITIALIZE="No" ISFIXLIST="No" ISALTER="No">
            <TYPE>StockGroup</TYPE>
            <FETCH>NAME, PARENT, GUID</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`,

    StockItemList: `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>StockItemList</ID></HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>${staticVars}</STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockItemList" ISINITIALIZE="No" ISFIXLIST="No" ISALTER="No">
            <TYPE>StockItem</TYPE>
            <FETCH>NAME, PARENT, GUID, UNIT, OPENINGQTY, OPENINGVALUE, CLOSINGQTY, CLOSINGVALUE, RATE, GSTRATE, HSNCODE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`,
  };

  return templates[reportName];
}

function buildVoucherXml(companyName, fromDate, toDate) {
  const escapedCompany = escapeXml(companyName);
  const companyVar = escapedCompany ? `<SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>` : '';
  const dateVars = fromDate ? `<SVFROMDATE>${fmtDate(fromDate)}</SVFROMDATE>` : '';
  const dateVars2 = toDate ? `<SVTODATE>${fmtDate(toDate)}</SVTODATE>` : '';
  const staticVars = `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyVar}${dateVars}${dateVars2}`;

  return `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VoucherList</ID></HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>${staticVars}</STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="VoucherList" ISINITIALIZE="No" ISFIXLIST="No" ISALTER="No">
            <TYPE>Voucher</TYPE>
            <FETCH>VOUCHERNUMBER, DATE, VOUCHERTYPENAME, NARRATION, TOTALAMOUNT, GUID, LEDGERENTRIES</FETCH>
            <FILTERS><FILTER>ISNOTCANCELLED: Yes</FILTER></FILTERS>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

// ─── Tally Fetch ─────────────────────────────────────────────────────────────

async function fetchFromTally(xml) {
  const res = await axios.post(`http://${TALLY_HOST}:${TALLY_PORT}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
    timeout: 30000,
  });
  return parser.parse(res.data);
}

function val(obj, ...fields) {
  if (!obj) return '';
  for (const f of fields) {
    const u = f.toUpperCase(), l = f.toLowerCase();
    const cap = f[0].toUpperCase() + f.slice(1).toLowerCase();
    for (const c of [f, u, l, cap]) {
      const v = obj[c] || obj[`@_${c}`];
      if (v != null) return typeof v === 'object' ? (v['#text'] ?? '') : String(v);
    }
  }
  return '';
}

// ─── Data Extractors ─────────────────────────────────────────────────────────

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function checkErrors(parsed) {
  const messages = parsed?.ENVELOPE?.BODY?.DESC?.TALLYMESSAGE || [];
  for (const msg of messages) {
    if (msg.LINEERROR && msg.LINEERROR.length > 0) {
      const err = msg.LINEERROR[0]['#text'] || msg.LINEERROR[0];
      throw new Error(err);
    }
  }
}

function collectionItems(parsed, tag) {
  const dataColl = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!dataColl || dataColl.length === 0) return [];
  const upper = tag.toUpperCase();
  const lower = tag.toLowerCase();
  const capitalized = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
  const obj = dataColl[0];
  const items = obj[tag] || obj[upper] || obj[lower] || obj[capitalized];
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function extractLedgers(parsed) {
  const ledgers = [];
  if (!parsed?.ENVELOPE) return ledgers;
  checkErrors(parsed);

  const groups = collectionItems(parsed, 'GROUP');
  for (const g of groups) {
    walkGroup(g, null, ledgers);
  }
  return ledgers;
}

function walkGroup(group, rootName, result) {
  const currentRoot = rootName || val(group, 'NAME');
  const groupLedgers = group.LEDGER || [];
  for (const l of (Array.isArray(groupLedgers) ? groupLedgers : [groupLedgers])) {
    if (typeof l !== 'object') continue;
    result.push({
      tallyId: val(l, 'GUID', 'NAME'),
      name: val(l, 'NAME'),
      groupName: val(group, 'NAME'),
      parentGroup: currentRoot,
      openingBalance: parseFloat(val(l, 'OPENINGBALANCE') || '0'),
      currentBalance: parseFloat(val(l, 'CLOSINGBALANCE') || '0'),
    });
  }
  const subGroups = group.GROUP || [];
  for (const sg of (Array.isArray(subGroups) ? subGroups : [subGroups])) {
    if (typeof sg === 'object') walkGroup(sg, currentRoot, result);
  }
}

function extractStockGroups(parsed) {
  const groups = [];
  if (!parsed?.ENVELOPE) return groups;
  checkErrors(parsed);

  const items = collectionItems(parsed, 'STOCKGROUP');
  for (const sg of items) {
    if (typeof sg !== 'object') continue;
    groups.push({
      tallyId: val(sg, 'GUID', 'NAME'),
      name: val(sg, 'NAME'),
      parentGroup: val(sg, 'PARENT') || null,
    });
  }
  return groups;
}

function extractStockItems(parsed) {
  const items = [];
  if (!parsed?.ENVELOPE) return items;
  checkErrors(parsed);

  const stockItems = collectionItems(parsed, 'STOCKITEM');
  for (const si of stockItems) {
    if (typeof si !== 'object') continue;
    items.push({
      tallyId: val(si, 'GUID', 'NAME'),
      name: val(si, 'NAME'),
      unit: val(si, 'UNIT') || 'PCS',
      openingQty: parseFloat(val(si, 'OPENINGQTY') || '0'),
      openingValue: parseFloat(val(si, 'OPENINGVALUE') || '0'),
      closingQty: parseFloat(val(si, 'CLOSINGQTY') || '0'),
      closingValue: parseFloat(val(si, 'CLOSINGVALUE') || '0'),
      rate: parseFloat(val(si, 'RATE') || '0'),
      gstRate: parseFloat(val(si, 'GSTRATE') || '0'),
      hsnCode: val(si, 'HSNCODE') || null,
      groupName: val(si, 'PARENT') || 'Primary',
    });
  }
  return items;
}

function extractVouchers(parsed) {
  const vouchers = [];
  if (!parsed?.ENVELOPE) return vouchers;
  checkErrors(parsed);

  const vList = collectionItems(parsed, 'VOUCHER');
  for (const v of vList) {
    if (typeof v !== 'object') continue;
    const guid = val(v, 'GUID', 'VOUCHERNUMBER');
    let entries = [];
    if (v['ALLLEDGERENTRIES.LIST']) {
      entries = Array.isArray(v['ALLLEDGERENTRIES.LIST']) ? v['ALLLEDGERENTRIES.LIST'] : [v['ALLLEDGERENTRIES.LIST']];
    } else if (v['LEDGERENTRIES.LIST']) {
      entries = Array.isArray(v['LEDGERENTRIES.LIST']) ? v['LEDGERENTRIES.LIST'] : [v['LEDGERENTRIES.LIST']];
    } else if (v.LEDGERENTRIES?.LEDGERENTRY) {
      entries = Array.isArray(v.LEDGERENTRIES.LEDGERENTRY) ? v.LEDGERENTRIES.LEDGERENTRY : [v.LEDGERENTRIES.LEDGERENTRY];
    }

    vouchers.push({
      tallyId: guid,
      number: val(v, 'VOUCHERNUMBER') || '',
      date: val(v, 'DATE', 'VOUCHERDATE') || '',
      type: val(v, 'VOUCHERTYPENAME') || '',
      narration: val(v, 'NARRATION') || '',
      totalAmount: parseFloat(val(v, 'TOTALAMOUNT') || '0'),
      entries: entries.map((e, idx) => ({
        tallyId: `${guid}-${idx}`,
        ledgerId: val(e, 'LEDGERNAME') || '',
        amount: parseFloat(val(e, 'AMOUNT') || '0'),
        type: e['@_ISDEEMEDPOSITIVE'] === 'Yes' ? 'DR' : 'CR',
      })),
    });
  }
  return vouchers;
}

// ─── Cloud API Calls ─────────────────────────────────────────────────────────

function cloudHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-gateway-id': config.gatewayId || '',
    'x-device-secret': config.deviceSecret || '',
  };
}

async function registerWithCloud() {
  log('Registering with cloud...');
  const res = await axios.post(`${CLOUD_URL}/api/config/remote`, {
    label: `Agent @ ${TALLY_HOST}:${TALLY_PORT}`,
    syncInterval: SYNC_INTERVAL,
  }, { timeout: 15000 });

  const { config: cloudConfig, credentials } = res.data;
  saveConfig({
    gatewayId: cloudConfig.gatewayId,
    cloudConfigId: cloudConfig.id,
    deviceSecret: credentials.deviceSecret,
  });
  log('Registered successfully (gatewayId: ' + cloudConfig.gatewayId.slice(0, 12) + '...)');
}

async function sendHeartbeat() {
  try {
    await axios.post(`${CLOUD_URL}/api/agent/heartbeat`, {}, {
      headers: cloudHeaders(),
      timeout: 10000,
    });
  } catch (err) {
    log('Heartbeat failed: ' + (err?.response?.data?.error || err?.message));
  }
}

// ─── Per-Company Sync (parallel master data) ────────────────────────────────

async function syncLedgers(companyName) {
  log(`  [${companyName}] Fetching ledgers...`);
  const xml = buildMasterXml('LedgerList', companyName);
  const parsed = await fetchFromTally(xml);
  const ledgers = extractLedgers(parsed);
  if (ledgers.length === 0) return 0;

  log(`  [${companyName}] Sending ${ledgers.length} ledgers to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, ledgers, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 60000 });
  return ledgers.length;
}

async function syncStockGroups(companyName) {
  log(`  [${companyName}] Fetching stock groups...`);
  const xml = buildMasterXml('StockGroupList', companyName);
  const parsed = await fetchFromTally(xml);
  const stockGroups = extractStockGroups(parsed);
  if (stockGroups.length === 0) return 0;

  log(`  [${companyName}] Sending ${stockGroups.length} stock groups to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, stockGroups, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 30000 });
  return stockGroups.length;
}

async function syncStockItems(companyName) {
  log(`  [${companyName}] Fetching stock items...`);
  const xml = buildMasterXml('StockItemList', companyName);
  const parsed = await fetchFromTally(xml);
  const stockItems = extractStockItems(parsed);
  if (stockItems.length === 0) return 0;

  log(`  [${companyName}] Sending ${stockItems.length} stock items to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, stockItems, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 60000 });
  return stockItems.length;
}

/**
 * Builds the list of [chunkStart, chunkEnd] date pairs covering the full
 * history range, so all voucher chunks for a company can be fetched
 * concurrently instead of one-after-another.
 */
function buildVoucherChunks(startDate, endDate) {
  const chunks = [];
  let chunkStart = new Date(startDate);
  while (chunkStart < endDate) {
    const chunkEnd = new Date(Math.min(
      chunkStart.getTime() + VOUCHER_CHUNK_DAYS * 24 * 60 * 60 * 1000,
      endDate.getTime()
    ));
    chunks.push([chunkStart, chunkEnd]);
    chunkStart = new Date(chunkEnd.getTime() + 1);
  }
  return chunks;
}

async function syncVoucherChunk(companyName, chunkStart, chunkEnd) {
  const label = `${chunkStart.toISOString().slice(0, 10)} to ${chunkEnd.toISOString().slice(0, 10)}`;
  log(`    [${companyName}] Fetching vouchers ${label}...`);
  const xml = buildVoucherXml(companyName, chunkStart, chunkEnd);

  let vouchers;
  try {
    const parsed = await fetchFromTally(xml);
    vouchers = extractVouchers(parsed);
  } catch (err) {
    log(`    [${companyName}] Failed to fetch voucher chunk ${label}: ${err?.message}`);
    return 0;
  }

  if (vouchers.length === 0) return 0;

  log(`    [${companyName}] Found ${vouchers.length} vouchers for ${label}, sending to cloud...`);
  try {
    await axios.post(`${CLOUD_URL}/api/agent/data`, {
      companyName, vouchers, host: TALLY_HOST, port: TALLY_PORT,
    }, { headers: cloudHeaders(), timeout: 120000 });
    return vouchers.length;
  } catch (err) {
    log(`    [${companyName}] Failed to sync voucher chunk ${label}: ${err?.message}`);
    return 0;
  }
}

async function syncVouchers(companyName) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startYear = currentMonth < 3 ? currentYear - 1 : currentYear;
  const startDate = new Date(startYear, 3, 1); // April 1st of current financial year
  const endDate = new Date();
  const chunks = buildVoucherChunks(startDate, endDate);

  log(`  [${companyName}] Fetching vouchers across ${chunks.length} date chunks (up to ${CONCURRENCY} at a time)...`);

  const counts = await pMap(chunks, ([chunkStart, chunkEnd]) =>
    syncVoucherChunk(companyName, chunkStart, chunkEnd)
  );

  return counts.reduce((sum, n) => sum + n, 0);
}

async function syncCompany(companyName) {
  log(`Syncing company: "${companyName}"`);
  try {
    // Ledgers, stock groups, stock items, and vouchers are independent data
    // sets, so fetch/send them all concurrently instead of sequentially.
    const [ledgers, stockGroups, stockItems, vouchers] = await Promise.all([
      syncLedgers(companyName),
      syncStockGroups(companyName),
      syncStockItems(companyName),
      syncVouchers(companyName),
    ]);
    log(`  Done "${companyName}": ${ledgers} ledgers, ${stockGroups} stock groups, ${stockItems} stock items, ${vouchers} vouchers`);
    return { companyName, ledgers, stockGroups, stockItems, vouchers };
  } catch (err) {
    log(`  Failed for "${companyName}": ${err?.message}`);
    return { companyName, ledgers: 0, stockGroups: 0, stockItems: 0, vouchers: 0 };
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  log('Tally Agent starting...');
  log(`Tally: http://${TALLY_HOST}:${TALLY_PORT}`);
  log(`Cloud: ${CLOUD_URL}`);
  log(`Concurrency: ${CONCURRENCY} (tune with CONCURRENCY env var)`);

  // Register if needed
  if (!config.gatewayId) {
    try {
      await registerWithCloud();
    } catch (err) {
      log('Registration failed: ' + (err?.response?.data?.error || err?.message));
      log('Make sure CLOUD_URL is correct and the cloud app is running.');
      process.exit(1);
    }
  } else {
    log('Already registered (gatewayId: ' + config.gatewayId.slice(0, 12) + '...)');
  }

  // Signal handler for graceful shutdown
  process.on('SIGINT', () => { log('Shutting down...'); running = false; });
  process.on('SIGTERM', () => { running = false; });

  while (running) {
    try {
      // Send heartbeat
      await sendHeartbeat();

      // Fetch company list from Tally
      log('Discovering companies from Tally...');
      const parsed = await fetchFromTally(buildCompanyXml());
      const companiesList = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[0]?.COMPANY || [];
      const companyNames = companiesList.map(c => typeof c.NAME === 'object' ? c.NAME['#text'] : c.NAME).filter(Boolean);

      if (companyNames.length === 0) {
        log('No companies found on Tally. Retrying...');
      } else {
        log(`Found ${companyNames.length} compan${companyNames.length === 1 ? 'y' : 'ies'}: ${companyNames.join(', ')}`);
        log(`Syncing all companies concurrently (up to ${CONCURRENCY} companies in flight)...`);

        // Sync all companies concurrently instead of one at a time.
        // Note: within pMap, each syncCompany() call itself fans out into
        // several concurrent sub-requests (ledgers/stock/vouchers), so the
        // effective in-flight request count is company-concurrency times
        // per-company sub-fetch concurrency. If Tally starts throwing
        // timeouts/ECONNRESET, lower CONCURRENCY rather than removing the
        // limiter entirely.
        const results = await pMap(companyNames, syncCompany);

        const totals = results.reduce((acc, r) => ({
          ledgers: acc.ledgers + r.ledgers,
          stockGroups: acc.stockGroups + r.stockGroups,
          stockItems: acc.stockItems + r.stockItems,
          vouchers: acc.vouchers + r.vouchers,
        }), { ledgers: 0, stockGroups: 0, stockItems: 0, vouchers: 0 });

        log(`Sync cycle completed. Totals: ${totals.ledgers} ledgers, ${totals.stockGroups} stock groups, ${totals.stockItems} stock items, ${totals.vouchers} vouchers`);

        // Update last sync time
        saveConfig({ lastSyncAt: new Date().toISOString() });
      }
    } catch (err) {
      log('Sync error: ' + (err?.message || err));
      log('Retrying in ' + (SYNC_INTERVAL / 1000) + 's...');
    }

    if (running) {
      log('Next sync in ' + (SYNC_INTERVAL / 60000) + ' minutes...');
      // Sleep in short intervals to allow graceful shutdown
      for (let i = 0; i < SYNC_INTERVAL / 1000 && running; i++) {
        await sleep(1000);
      }
    }
  }

  log('Agent stopped.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});