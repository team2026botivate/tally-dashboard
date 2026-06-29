import axios, { AxiosInstance } from 'axios';
import { XMLParser } from 'fast-xml-parser';

interface MastersData {
  ledgers: any;
  stockGroups: any;
  stockItems: any;
}

export class TallyDataFetcher {
  private client: AxiosInstance;
  private parser: XMLParser;
  private companyName: string;

  constructor(config: any) {
    this.client = axios.create({
      baseURL: `http://${config.host}:${config.port}`,
      timeout: 30000
    });
    this.companyName = config.companyName || '';
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      trimValues: true,
      isArray: (tagName: string) =>
        ['LEDGER', 'GROUP', 'STOCKGROUP', 'STOCKITEM', 'VOUCHER',
         'LEDGERENTRY', 'TALLYMESSAGE', 'COLLECTION', 'ADDRESS',
         'LINE', 'COMPANY'].includes(tagName)
    });
  }

  async fetchReport(reportName: string, params: Record<string, any> = {}): Promise<any> {
    const xml = this.buildXml(reportName, params);
    try {
      const response = await this.client.post('/', xml, {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 30000
      });
      const parsed = this.parser.parse(response.data);
      return this.transform(reportName, parsed);
    } catch (error: any) {
      console.error(`Failed to fetch ${reportName}:`, error?.message);
      throw new Error(error?.message || 'Unknown tally error');
    }
  }

  private buildXml(reportName: string, params: Record<string, any>): string {
    const dateVars = this.buildDateVars(params);
    const companyVar = this.companyName ? `<SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>` : '';
    const staticVars = `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyVar}${dateVars}`;

    switch (reportName) {
      case 'CompanyInfo':
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

      case 'LedgerList':
        return `<ENVELOPE>
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
</ENVELOPE>`;

      case 'StockGroupList':
        return `<ENVELOPE>
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
</ENVELOPE>`;

      case 'StockItemList':
        return `<ENVELOPE>
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
</ENVELOPE>`;

      case 'VoucherList':
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
            <FILTERS>
              <FILTER>ISNOTCANCELLED: Yes</FILTER>
            </FILTERS>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

      default:
        return `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${reportName}</ID></HEADER>
  <BODY><DESC><STATICVARIABLES>${staticVars}</STATICVARIABLES></DESC></BODY>
</ENVELOPE>`;
    }
  }

  private buildDateVars(params: Record<string, any>): string {
    let vars = '';
    if (params.fromDate) {
      const d = new Date(params.fromDate);
      vars += `<SVFROMDATE>${this.fmtDate(d)}</SVFROMDATE>`;
    }
    if (params.toDate) {
      const d = new Date(params.toDate);
      vars += `<SVTODATE>${this.fmtDate(d)}</SVTODATE>`;
    }
    return vars;
  }

  private fmtDate(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
  }

  private transform(reportName: string, parsed: any): any {
    const envelope = parsed.ENVELOPE;
    if (!envelope) return {};

    const messages = envelope.BODY?.DESC?.TALLYMESSAGE || [];
    // Collection-type responses put data in BODY.DATA.COLLECTION[0]
    const dataColl = envelope.BODY?.DATA?.COLLECTION;

    for (const msg of messages) {
      if (msg.LINEERROR && msg.LINEERROR.length > 0) {
        throw new Error(msg.LINEERROR[0]['#text'] || msg.LINEERROR[0]);
      }
    }

    switch (reportName) {
      case 'LedgerList':
        return this.transformLedgers(messages, dataColl);
      case 'StockGroupList':
        return this.transformStockGroups(messages, dataColl);
      case 'StockItemList':
        return this.transformStockItems(messages, dataColl);
      case 'VoucherList':
        return this.transformVouchers(messages, dataColl);
      default:
        return parsed;
    }
  }

  private collectionItems(dataColl: any[] | undefined, tag: string): any[] {
    if (!dataColl || dataColl.length === 0) return [];
    const items = dataColl[0][tag];
    return items || [];
  }

  private val(obj: any, ...fields: string[]): string {
    if (!obj) return '';
    for (const f of fields) {
      const v = obj[f] || obj[`@_${f}`];
      if (v != null) {
        if (typeof v === 'object') return v['#text'] ?? '';
        return String(v);
      }
      
      // Special case for Tally's NAME.LIST
      if (f === 'NAME' && obj['NAME.LIST']) {
        const nameList = obj['NAME.LIST'];
        if (nameList.NAME) {
          if (Array.isArray(nameList.NAME)) return String(nameList.NAME[0]);
          return String(nameList.NAME);
        }
      }
    }
    return '';
  }

  private transformLedgers(messages: any[], dataColl?: any[]): any {
    const groups: any[] = [];
    // Legacy format: TALLYMESSAGE > COLLECTION > GROUP
    for (const msg of messages) {
      const collection = msg.COLLECTION;
      if (collection?.GROUP) {
        for (const g of collection.GROUP) {
          groups.push(this.walkGroup(g));
        }
      }
    }
    // New format: DATA > COLLECTION > GROUP
    if (groups.length === 0) {
      for (const g of this.collectionItems(dataColl, 'GROUP')) {
        groups.push(this.walkGroup(g));
      }
    }
    return { groups };
  }

  private walkGroup(group: any): any {
    const ledgers = (group.LEDGER || []).map((l: any) => ({
      name: this.val(l, 'NAME'),
      guid: this.val(l, 'GUID', 'NAME'),
      openingBalance: this.val(l, 'OPENINGBALANCE') || '0',
      closingBalance: this.val(l, 'CLOSINGBALANCE') || '0',
    }));
    const subGroups = (group.GROUP || []).map((g: any) => this.walkGroup(g));
    return { name: this.val(group, 'NAME'), ledgers, groups: subGroups };
  }

  private transformStockGroups(messages: any[], dataColl?: any[]): any {
    const groups: any[] = [];
    for (const msg of messages) {
      const collection = msg.COLLECTION;
      if (collection?.STOCKGROUP) {
        for (const sg of collection.STOCKGROUP) {
          groups.push(this.extractStockGroup(sg));
        }
      }
    }
    if (groups.length === 0) {
      for (const sg of this.collectionItems(dataColl, 'STOCKGROUP')) {
        groups.push(this.extractStockGroup(sg));
      }
    }
    return { groups };
  }

  private extractStockGroup(sg: any): any {
    return {
      guid: this.val(sg, 'GUID', 'NAME'),
      name: this.val(sg, 'NAME'),
      parentGroup: this.val(sg, 'PARENT') || null,
    };
  }

  private transformStockItems(messages: any[], dataColl?: any[]): any {
    const items: any[] = [];
    for (const msg of messages) {
      const collection = msg.COLLECTION;
      if (collection?.STOCKITEM) {
        for (const si of collection.STOCKITEM) {
          items.push(this.extractStockItem(si));
        }
      }
    }
    if (items.length === 0) {
      for (const si of this.collectionItems(dataColl, 'STOCKITEM')) {
        items.push(this.extractStockItem(si));
      }
    }
    return { groupName: 'Primary', items };
  }

  private extractStockItem(si: any): any {
    return {
      name: this.val(si, 'NAME'),
      guid: this.val(si, 'GUID', 'NAME'),
      unit: this.val(si, 'UNIT') || 'PCS',
      openingQty: this.val(si, 'OPENINGQTY') || '0',
      openingValue: this.val(si, 'OPENINGVALUE') || '0',
      closingQty: this.val(si, 'CLOSINGQTY') || '0',
      closingValue: this.val(si, 'CLOSINGVALUE') || '0',
      rate: this.val(si, 'RATE') || '0',
      gstRate: this.val(si, 'GSTRATE') || '0',
      hsnCode: this.val(si, 'HSNCODE') || null,
      groupName: this.val(si, 'PARENT') || 'Primary',
    };
  }

  private transformVouchers(messages: any[], dataColl?: any[]): any {
    const vouchers: any[] = [];
    for (const msg of messages) {
      const collection = msg.COLLECTION;
      if (collection?.VOUCHER) {
        for (const v of collection.VOUCHER) {
          vouchers.push(this.extractVoucher(v));
        }
      }
    }
    if (vouchers.length === 0) {
      for (const v of this.collectionItems(dataColl, 'VOUCHER')) {
        vouchers.push(this.extractVoucher(v));
      }
    }
    return { vouchers };
  }

  private extractVoucher(v: any): any {
    const entries = v.LEDGERENTRIES?.LEDGERENTRY || [];
    const guid = this.val(v, 'GUID', 'VOUCHERNUMBER');
    return {
      guid,
      number: this.val(v, 'VOUCHERNUMBER') || '',
      date: this.val(v, 'DATE', 'VOUCHERDATE') || '',
      type: this.val(v, 'VOUCHERTYPENAME') || '',
      narration: this.val(v, 'NARRATION') || '',
      totalAmount: this.val(v, 'TOTALAMOUNT') || '0',
      entries: entries.map((e: any, idx: number) => ({
        tallyId: `${guid}-${idx}`,
        ledgerId: this.val(e, 'LEDGERNAME') || '',
        amount: parseFloat(this.val(e, 'AMOUNT') || '0'),
        type: e['@_ISDEEMEDPOSITIVE'] === 'Yes' ? 'DR' : 'CR',
      })),
    };
  }

  async fetchAllMasters(): Promise<MastersData> {
    let ledgers: any = { groups: [] };
    let stockGroups: any = { groups: [] };
    let stockItems: any = { groupName: 'Primary', items: [] };

    console.log('Fetching ledgers...');
    try { ledgers = await this.fetchReport('LedgerList'); console.log('Ledgers OK'); } catch (e: any) { console.error('Ledgers failed:', e.message); }

    console.log('Fetching stock groups...');
    try { stockGroups = await this.fetchReport('StockGroupList'); console.log('StockGroups OK'); } catch (e: any) { console.error('StockGroups failed:', e.message); }

    console.log('Fetching stock items...');
    try { stockItems = await this.fetchReport('StockItemList'); console.log('StockItems OK'); } catch (e: any) { console.error('StockItems failed:', e.message); }

    return { ledgers, stockGroups, stockItems };
  }

  async fetchVouchers(fromDate?: Date, toDate?: Date): Promise<any> {
    const params: Record<string, any> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return this.fetchReport('VoucherList', params);
  }
}
