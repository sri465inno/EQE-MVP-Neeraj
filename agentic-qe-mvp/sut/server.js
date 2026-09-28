'use strict';
const { createSutApp } = require('./app');

function startSut({ version = 'main', port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = createSutApp({ version }).listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      resolve({ url, version, close: () => new Promise((r) => server.close(() => r())) });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startSut({ version: process.env.SUT_VERSION || 'main', port: Number(process.env.SUT_PORT || 4100) })
    .then((s) => console.log(`StayWell booking-service (${s.version}) on ${s.url}`));
}

module.exports = { startSut };
