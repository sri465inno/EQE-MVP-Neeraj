// Usage: node scripts/wait-for-url.js <url> [seconds]. Exits 0 once the URL answers, 1 after the timeout.
const [url = 'http://localhost:4000', seconds = '30'] = process.argv.slice(2);
const deadline = Date.now() + Number(seconds) * 1000;
const attempt = () => fetch(url, { signal: AbortSignal.timeout(2000) })
  .then(() => process.exit(0))
  .catch(() => (Date.now() < deadline ? setTimeout(attempt, 1000) : process.exit(1)));
attempt();
