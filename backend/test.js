const http = require('http');

const endpoints = [
  '/api/dashboard/balance-sheet?companyId=test',
  '/api/dashboard/trial-balance?companyId=test',
  '/api/dashboard/voucher-trends?companyId=test',
  '/api/dashboard/top-ledgers?companyId=test',
  '/api/dashboard/stock-summary?companyId=test',
  '/api/dashboard/recent-vouchers?companyId=test'
];

async function check() {
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      http.get('http://localhost:3001' + ep, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(ep, '-> status:', res.statusCode);
          if (res.statusCode >= 400) console.log('ERROR:', data);
          resolve();
        });
      }).on('error', (err) => {
        console.log(ep, '-> request error:', err.message);
        resolve();
      });
    });
  }
}

check();
