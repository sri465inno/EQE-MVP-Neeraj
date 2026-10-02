'use strict';
// Builds hotel booking release 2.0 (branch demo/hotel-booking-platform-v2) into .hotel-builds/ so Flow 2 can run it.
// Usage: node scripts/build-hotel-v2.js   (needs git, Java 21 and Maven; HOTEL_PLATFORM_V2_DIR overrides the folder)
const fs = require('fs');
const { execFileSync } = require('child_process');
const { platformDir, HOTEL_BRANCH_V2 } = require('../sut/hotel');
const { SOURCE } = require('../src/connectors/codebase');

const dir = platformDir(process.env, HOTEL_BRANCH_V2);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

if (fs.existsSync(`${dir}/.git`)) {
  run('git', ['fetch', '--quiet', '--depth', '1', 'origin', HOTEL_BRANCH_V2], dir);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], dir);
} else if (!fs.existsSync(`${dir}/pom.xml`)) {
  run('git', ['clone', '--quiet', '--depth', '1', '--single-branch', '--branch', HOTEL_BRANCH_V2, SOURCE.cloneUrl, dir]);
}
run('mvn', ['-q', '-B', '-DskipTests', 'install'], dir);
console.log(`Release 2.0 built in ${dir}`);
