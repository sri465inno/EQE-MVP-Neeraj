'use strict';
// Type of testing chosen on Run. Together with the project inputs, the skills and the flow it decides
// which test cases the design agents produce and which of them the execution agent runs.
//
// Every candidate case has a suite:
//   api      functional rule checks through the service API
//   ui       a browser check of a screen described in the inputs
//   journey  an end-to-end user journey (commission: store reservation -> statement -> total;
//            hotel: search -> details -> offers -> cart -> payment -> reservation -> confirmation e-mail)
//   nfr      a non-functional check stated in the inputs (e.g. quote latency)
//   load     the same non-functional target under concurrent users

const { HOTEL_SMOKE_SLOTS } = require('./agents/hotel-catalogue');

const SMOKE_SLOTS = new Set(['base-commission-rate|base', 'reservation-data-dictionary|dictionary', 'commission-statement-ui|ui', ...HOTEL_SMOKE_SLOTS]);

const TESTING_TYPES = [
  {
    id: 'functional', name: 'Functional testing', short: 'Functional', suites: ['api'],
    produces: { functional: true, nonFunctional: false },
    focus: 'Every business rule and its boundaries, checked through the service API.',
    baseline: 'Designs every functional test case and Playwright script from the inputs and runs them all.',
    incremental: 'Keeps the functional cases already in the baseline, re-designs the ones whose rule changed, adds cases for new rules, then runs the functional pack.',
    agents: {
      testcases: 'Functional cases for every business rule, including both sides of each boundary',
      testdata: 'One data set per case, with the drivers either side of each boundary',
      scripts: 'API-level Playwright specs, one per business rule',
      execution: 'Runs every functional case against the build',
    },
  },
  {
    id: 'e2e', name: 'End-to-end testing', short: 'End-to-end', suites: ['ui', 'journey'],
    produces: { functional: true, nonFunctional: false },
    focus: "The travel advisor's experience: store a reservation, open the commission statement in the browser and check every line and the total they see.",
    baseline: 'Designs one browser journey per money rule plus the statement screen check, and runs them in a real browser with screenshots.',
    incremental: 'Keeps the journeys already in the baseline, adds journeys for new and changed rules, then runs them in the browser.',
    agents: {
      testcases: 'User-journey cases written from the advisor’s point of view',
      testdata: 'A stored reservation for each advisor journey',
      scripts: 'Browser Playwright specs that drive the statement page',
      execution: 'Runs the journeys in headless Chromium and keeps a screenshot of each',
    },
    domains: {
      hotel: {
        focus: "The guest's booking journey through the six services: search, hotel details, offers, cart, payment, reservation and the confirmation e-mail.",
        baseline: 'Designs one API journey per guest flow in the inputs and runs it against the six hotel services, keeping every request and response as evidence. The services have no browser screen, so no screenshots are taken.',
        agents: {
          testcases: 'Guest-journey cases from search to the confirmation e-mail',
          testdata: 'A search, stay and guest for each journey',
          scripts: 'Playwright API specs that call the services in journey order',
          execution: 'Runs the journeys against the six hotel services and keeps each request and response',
        },
      },
    },
  },
  {
    id: 'regression', name: 'Regression testing', short: 'Regression', suites: ['api', 'ui', 'nfr'], rerunsCarried: true,
    produces: { functional: true, nonFunctional: true },
    focus: 'The full pack: every functional, screen and non-functional case, so nothing that worked before has broken.',
    baseline: 'No earlier pack exists, so it designs the full regression pack (functional, screen and non-functional) and runs it.',
    incremental: 'Re-runs every case carried over from the baseline alongside the new and re-designed ones.',
    agents: {
      testcases: 'The full pack: functional, screen and non-functional cases',
      testdata: 'Keeps the data sets of carried-over cases; regenerates only the changed ones',
      scripts: 'Playwright specs for every automatable case',
      execution: 'Re-runs the whole pack, carried-over cases included',
    },
    domains: {
      hotel: {
        focus: 'The full pack: every functional case plus the privacy, security, observability and resilience cases, so nothing that worked before has broken.',
        baseline: 'No earlier pack exists, so it designs the full regression pack (functional and cross-cutting quality) and runs it.',
        agents: { testcases: 'The full pack: functional and cross-cutting quality cases (AQPI-28 to AQPI-31)' },
      },
    },
  },
  {
    id: 'smoke', name: 'Smoke testing', short: 'Smoke', suites: [], smoke: true,
    produces: { functional: true, nonFunctional: false },
    focus: 'A few critical checks that show the build is worth testing further: the base commission, the full 1,000-attribute reservation and the statement page.',
    baseline: 'Designs only the critical-path cases; the other requirements are listed as out of scope for this run.',
    incremental: 'Keeps the baseline pack untouched and runs only its critical-path cases on the new build.',
    agents: {
      testcases: 'Only the critical-path cases',
      testdata: 'Data sets for the critical-path cases only',
      scripts: 'Playwright specs for the critical path',
      execution: 'Runs the critical path only, in seconds',
    },
    domains: {
      hotel: { focus: 'A few critical checks that show the build is worth testing further: hotel search, the booking data dictionary and a reservation.' },
    },
  },
  {
    id: 'performance', name: 'Performance testing', short: 'Performance', suites: ['nfr', 'load'],
    produces: { functional: false, nonFunctional: true },
    focus: 'The response-time targets stated in the inputs, measured for one advisor and under concurrent advisors.',
    baseline: 'Designs a latency check and a concurrent-load check for every response-time target in the inputs. If the inputs state none, it reports the gap instead of inventing a target.',
    incremental: 'Keeps the baseline targets, re-designs checks for changed targets and re-measures them on the new build.',
    agents: {
      testcases: 'Latency and concurrent-load cases, one pair per stated target',
      testdata: 'One full reservation reused for every timed request',
      scripts: 'Playwright specs that time real requests and attach the samples',
      execution: 'Measures p95 response times against the build',
    },
  },
];

const DEFAULT_TESTING_TYPE = 'regression';
const BY_ID = new Map(TESTING_TYPES.map((t) => [t.id, t]));

/** Ids of a testing-type value: one id, a list of ids, or ids joined with "+" (as persisted on a cycle). */
function testingTypeIds(value) {
  if (value === undefined || value === null || value === '') return [DEFAULT_TESTING_TYPE];
  const list = Array.isArray(value) ? value : String(value).split('+');
  const unknown = list.filter((id) => !BY_ID.has(id));
  if (unknown.length || !list.length) throw new Error(`testingType must be one of: ${TESTING_TYPES.map((x) => x.id).join(', ')}${list.length ? '' : ' (choose at least one)'}`);
  return TESTING_TYPES.map((t) => t.id).filter((id) => list.includes(id));
}

/**
 * The type of testing for a run. Several types combine into one run: the union of their suites,
 * the smoke critical path if smoke is among them, and carried-over cases re-run if regression is.
 */
/** A testing type with the wording of one domain (e.g. 'hotel') applied over the default wording. */
function inDomain(t, domainId) {
  const o = t.domains?.[domainId];
  return o ? { ...t, ...o, agents: { ...t.agents, ...o.agents } } : t;
}

function getTestingType(value, domainId) {
  const ids = testingTypeIds(value);
  if (ids.length === 1) return { ...inDomain(BY_ID.get(ids[0]), domainId), ids };
  const parts = ids.map((id) => inDomain(BY_ID.get(id), domainId));
  const each = (field) => parts.map((p) => `${p.short}: ${p[field]}`).join(' ');
  const agents = {};
  for (const p of parts) for (const [agent, text] of Object.entries(p.agents)) agents[agent] = [...(agents[agent] ? [agents[agent]] : []), `${p.short}: ${text}`].join(' · ');
  return {
    id: ids.join('+'), ids,
    name: `${parts.map((p) => p.short).join(' + ')} testing`,
    short: parts.map((p) => p.short).join(' + '),
    suites: [...new Set(parts.flatMap((p) => p.suites))],
    smoke: parts.some((p) => p.smoke),
    rerunsCarried: parts.some((p) => p.rerunsCarried),
    produces: { functional: parts.some((p) => p.produces.functional), nonFunctional: parts.some((p) => p.produces.nonFunctional) },
    focus: each('focus'), baseline: each('baseline'), incremental: each('incremental'), agents,
  };
}

/** Suite of a persisted case; cases designed before suites existed fall back on their type. */
function suiteOf(tc) {
  if (tc.suite) return tc.suite;
  if (tc.ui) return 'ui';
  return tc.type === 'non-functional' ? 'nfr' : 'api';
}

/** Whether a case belongs in a run of this testing type. Carried-over cases are re-run by regression. */
function inRun(type, { suite, kind, slot }, { carried = false } = {}) {
  if (type.smoke && SMOKE_SLOTS.has(`${kind}|${slot}`)) return true;
  if (carried && type.rerunsCarried) return true;
  return type.suites.includes(suite);
}

module.exports = { TESTING_TYPES, DEFAULT_TESTING_TYPE, SMOKE_SLOTS, getTestingType, testingTypeIds, suiteOf, inRun };
