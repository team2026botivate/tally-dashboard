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
  const companyVar = companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : '';
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
  const companyVar = companyName ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>` : '';
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

function extractLedgers(parsed) {
  const ledgers = [];
  const envelope = parsed.ENVELOPE;
  if (!envelope) return ledgers;
  const messages = envelope.BODY?.DESC?.TALLYMESSAGE || [];

  for (const msg of messages) {
    const groups = msg.COLLECTION?.GROUP || [];
    for (const g of groups) {
      walkGroup(g, null, ledgers);
    }
  }
  return ledgers;
}

function walkGroup(group, rootName, result) {
  const currentRoot = rootName || val(group, 'NAME');
  const groupLedgers = group.LEDGER || [];
  for (const l of groupLedgers) {
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
  for (const sg of subGroups) {
    walkGroup(sg, currentRoot, result);
  }
}

function extractStockGroups(parsed) {
  const groups = [];
  const envelope = parsed.ENVELOPE;
  if (!envelope) return groups;
  const messages = envelope.BODY?.DESC?.TALLYMESSAGE || [];

  for (const msg of messages) {
    const items = msg.COLLECTION?.STOCKGROUP || [];
    for (const sg of items) {
      groups.push({
        tallyId: val(sg, 'GUID', 'NAME'),
        name: val(sg, 'NAME'),
        parentGroup: val(sg, 'PARENT') || null,
      });
    }
  }
  return groups;
}

function extractStockItems(parsed) {
  const items = [];
  const envelope = parsed.ENVELOPE;
  if (!envelope) return items;
  const messages = envelope.BODY?.DESC?.TALLYMESSAGE || [];

  for (const msg of messages) {
    const stockItems = msg.COLLECTION?.STOCKITEM || [];
    for (const si of stockItems) {
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
  }
  return items;
}

function extractVouchers(parsed) {
  const vouchers = [];
  const envelope = parsed.ENVELOPE;
  if (!envelope) return vouchers;
  const messages = envelope.BODY?.DESC?.TALLYMESSAGE || [];

  for (const msg of messages) {
    const vList = msg.COLLECTION?.VOUCHER || [];
    for (const v of vList) {
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

async function syncLedgers(companyName) {
  log(`  Fetching ledgers for "${companyName}"...`);
  const xml = buildMasterXml('LedgerList', companyName);
  const parsed = await fetchFromTally(xml);
  const ledgers = extractLedgers(parsed);
  if (ledgers.length === 0) return 0;

  log(`  Sending ${ledgers.length} ledgers to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, ledgers, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 60000 });
  return ledgers.length;
}

async function syncStockGroups(companyName) {
  log(`  Fetching stock groups for "${companyName}"...`);
  const xml = buildMasterXml('StockGroupList', companyName);
  const parsed = await fetchFromTally(xml);
  const stockGroups = extractStockGroups(parsed);
  if (stockGroups.length === 0) return 0;

  log(`  Sending ${stockGroups.length} stock groups to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, stockGroups, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 30000 });
  return stockGroups.length;
}

async function syncStockItems(companyName) {
  log(`  Fetching stock items for "${companyName}"...`);
  const xml = buildMasterXml('StockItemList', companyName);
  const parsed = await fetchFromTally(xml);
  const stockItems = extractStockItems(parsed);
  if (stockItems.length === 0) return 0;

  log(`  Sending ${stockItems.length} stock items to cloud...`);
  await axios.post(`${CLOUD_URL}/api/agent/data`, {
    companyName, stockItems, host: TALLY_HOST, port: TALLY_PORT,
  }, { headers: cloudHeaders(), timeout: 60000 });
  return stockItems.length;
}

async function syncVouchers(companyName) {
  const startDate = new Date('2000-01-01');
  const endDate = new Date();
  let total = 0;
  let chunkStart = new Date(startDate);

  log(`  Fetching vouchers for "${companyName}"...`);

  while (chunkStart < endDate) {
    const chunkEnd = new Date(Math.min(
      chunkStart.getTime() + VOUCHER_CHUNK_DAYS * 24 * 60 * 60 * 1000,
      endDate.getTime()
    ));

    log(`    ${chunkStart.toISOString().slice(0,10)} to ${chunkEnd.toISOString().slice(0,10)}...`);
    const xml = buildVoucherXml(companyName, chunkStart, chunkEnd);
    const parsed = await fetchFromTally(xml);
    const vouchers = extractVouchers(parsed);

    if (vouchers.length > 0) {
      log(`    Found ${vouchers.length} vouchers, sending to cloud...`);
      try {
        await axios.post(`${CLOUD_URL}/api/agent/data`, {
          companyName, vouchers, host: TALLY_HOST, port: TALLY_PORT,
        }, { headers: cloudHeaders(), timeout: 120000 });
        total += vouchers.length;
      } catch (err) {
        log(`    Failed to sync voucher chunk: ${err?.message}`);
      }
    }

    chunkStart = new Date(chunkEnd.getTime() + 1);
  }

  return total;
}

async function syncCompany(companyName) {
  log(`Syncing company: "${companyName}"`);
  try {
    const ledgers = await syncLedgers(companyName);
    const stockGroups = await syncStockGroups(companyName);
    const stockItems = await syncStockItems(companyName);
    const vouchers = await syncVouchers(companyName);
    log(`  Done: ${ledgers} ledgers, ${stockGroups} stock groups, ${stockItems} stock items, ${vouchers} vouchers`);
    return { ledgers, stockGroups, stockItems, vouchers };
  } catch (err) {
    log(`  Failed for "${companyName}": ${err?.message}`);
    return { ledgers: 0, stockGroups: 0, stockItems: 0, vouchers: 0 };
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  log('Tally Agent starting...');
  log(`Tally: http://${TALLY_HOST}:${TALLY_PORT}`);
  log(`Cloud: ${CLOUD_URL}`);

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

  let firstRun = true;

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

        // Sync each company
        for (const name of companyNames) {
          if (!running) break;
          await syncCompany(name);
        }

        // Update last sync time
        saveConfig({ lastSyncAt: new Date().toISOString() });
        log('Sync cycle completed.');
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
