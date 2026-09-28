'use strict';
// Starts the bundled system under test: the sample Aurora commission engine, one build per codebase branch.
const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', 'samples', 'commission-engine');
const BUILDS = {
  'demo/commission-engine': 'baseline',
  'demo/commission-engine-v2': 'v2',
};
const DEFAULT_BUILD = 'demo/commission-engine';

function createSutApp({ version = DEFAULT_BUILD } = {}) {
  const dir = BUILDS[version];
  if (!dir) throw new Error(`Unknown SUT build "${version}"`);
  return require(path.join(ENGINE_DIR, dir, 'src', 'app.js')).createApp();
}

function startSut({ version = DEFAULT_BUILD, port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = createSutApp({ version }).listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      resolve({ url, version, close: () => new Promise((r) => server.close(() => r())) });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startSut({ version: process.env.SUT_VERSION || DEFAULT_BUILD, port: Number(process.env.SUT_PORT || 4100) })
    .then((s) => console.log(`Aurora commission engine (${s.version}) on ${s.url}`));
}

module.exports = { startSut, createSutApp, BUILDS, DEFAULT_BUILD, ENGINE_DIR };
