'use strict';
// Starts the hotel booking platform (Java 21 Spring Boot WebFlux, six services) as the system under test.
// The services run from the jars `mvn install` builds in hotel-booking-platform/, each on a free local port.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const HOTEL_BRANCH = 'demo/hotel-booking-platform';
const VERSION = '1.0.0-SNAPSHOT';
// Start order: a service only starts once the services it calls are known.
const SERVICES = [
  { name: 'hotel-service', deps: [] },
  { name: 'offer-service', deps: [] },
  { name: 'notification-service', deps: [] },
  { name: 'search-service', deps: ['hotel-service'] },
  { name: 'cart-service', deps: ['hotel-service', 'offer-service'] },
  { name: 'reservation-service', deps: ['cart-service', 'hotel-service', 'notification-service'] },
];

const platformDir = (env = process.env) => path.resolve(env.HOTEL_PLATFORM_DIR || path.join(__dirname, '..', '..', 'hotel-booking-platform'));
const jarOf = (dir, name) => path.join(dir, name, 'target', `${name}-${VERSION}-exec.jar`);
const javaBin = (env = process.env) => (env.JAVA_HOME ? path.join(env.JAVA_HOME, 'bin', 'java') : 'java');

/** Why the hotel services cannot start here, or null when every jar is built. */
function unavailableReason(env = process.env) {
  const dir = platformDir(env);
  const missing = SERVICES.filter((s) => !fs.existsSync(jarOf(dir, s.name))).map((s) => s.name);
  if (!missing.length) return null;
  return `The hotel booking services are not built (${missing.join(', ')} missing under ${dir}). Build them with "npm run build:hotel" (needs Java 21 and Maven).`;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

async function waitHealthy(url, child, log, deadline) {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`exited with code ${child.exitCode}: ${log().slice(-600)}`);
    try {
      const res = await fetch(`${url}/actuator/health`);
      if (res.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`not healthy within the start-up time: ${log().slice(-600)}`);
}

function stop(children) {
  return Promise.all(children.map((c) => new Promise((resolve) => {
    if (c.exitCode !== null || c.signalCode) { resolve(); return; }
    const timer = setTimeout(() => c.kill('SIGKILL'), 5000);
    c.once('exit', () => { clearTimeout(timer); resolve(); });
    c.kill('SIGTERM');
  })));
}

/** Starts all six services; resolves with their URLs and a close() that stops them. */
async function startHotelPlatform({ env = process.env, timeoutMs = 120000 } = {}) {
  const reason = unavailableReason(env);
  if (reason) { const err = new Error(reason); err.code = 'SUT_UNAVAILABLE'; throw err; }
  const dir = platformDir(env);
  const urls = {};
  for (const s of SERVICES) urls[s.name] = `http://127.0.0.1:${await freePort()}`;
  const children = [];
  const deadline = Date.now() + timeoutMs;
  try {
    for (const s of SERVICES) {
      const args = ['-XX:TieredStopAtLevel=1', '-Xss512k', '-Xmx256m', '-jar', jarOf(dir, s.name), `--spring.config.name=${s.name}`,
        `--server.port=${new URL(urls[s.name]).port}`, '--server.address=127.0.0.1', '--spring.main.banner-mode=off',
        ...s.deps.map((d) => `--platform.dependencies.${d}.base-url=${urls[d]}`)];
      let out = '';
      const child = spawn(javaBin(env), args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => { out = (out + d).slice(-20000); });
      child.stderr.on('data', (d) => { out = (out + d).slice(-20000); });
      child.on('error', (e) => { out += `\n${e.message}`; });
      child.service = s.name;
      child.log = () => out;
      children.push(child);
    }
    for (const c of children) {
      try { await waitHealthy(urls[c.service], c, c.log, deadline); } catch (e) { throw new Error(`${c.service} ${e.message}`); }
    }
  } catch (e) {
    await stop(children);
    const err = new Error(`The hotel booking services did not start: ${e.message}`);
    err.code = 'SUT_UNAVAILABLE';
    throw err;
  }
  return {
    url: urls['search-service'], urls, dir,
    name: `Hotel booking platform, six Spring Boot services built from hotel-booking-platform/ (branch ${HOTEL_BRANCH})`,
    close: () => stop(children),
  };
}

if (require.main === module) {
  startHotelPlatform().then((p) => {
    console.log(JSON.stringify(p.urls, null, 2));
    const bye = () => p.close().then(() => process.exit(0));
    process.on('SIGINT', bye);
    process.on('SIGTERM', bye);
  }, (e) => { console.error(e.message); process.exit(1); });
}

module.exports = { startHotelPlatform, unavailableReason, platformDir, HOTEL_BRANCH, SERVICES };
