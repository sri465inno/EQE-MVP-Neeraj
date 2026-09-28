'use strict';
// The wider Agentic QE Platform (seven agents, many input types) and the slice of it this MVP implements.

const SEVEN_AGENTS = [
  { no: 1, id: 'requirements', name: 'Requirements agent', produces: 'Requirements repository (reviewed, versioned, traceable to Jira keys and source lines)' },
  { no: 2, id: 'rules', name: 'Business rules agent', produces: 'Business rules with parameters and source quotes' },
  { no: 3, id: 'testcases', name: 'Test design agent', produces: 'Functional and non-functional test cases (Zephyr Scale Excel export)' },
  { no: 4, id: 'scripts', name: 'Automation agent', produces: 'Self-contained Playwright specs' },
  { no: 5, id: 'execution', name: 'Execution agent', produces: 'Real Playwright run results with evidence' },
  { no: 6, id: 'defects', name: 'Defect agent', produces: 'Defects raised only from real failures' },
  { no: 7, id: 'report', name: 'Reporting agent', produces: 'Cycle report, coverage and cycle comparison' },
];

// Deterministic intake and human gates around the agents (not agents: no design decisions are delegated here).
const INTAKE_STAGES = ['ingest', 'normalise', 'review', 'delta', 'merge-approval'];

const INPUT_TYPES = [
  { id: 'jira-initiative', name: 'Jira initiative', mvp: 'implemented', note: 'Business capability scope (COM-1)' },
  { id: 'jira-epic', name: 'Jira epic (+ child stories)', mvp: 'implemented', note: 'Acceptance criteria per epic (COM-10, COM-20)' },
  { id: 'codebase', name: 'Codebase (GitHub branch)', mvp: 'implemented', note: 'README, @rule source notes and the reservation data dictionary' },
  { id: 'data-model', name: 'Data model / data dictionary', mvp: 'via codebase', note: 'Read from data-dictionary/ in the codebase input; not a separate input' },
  { id: 'confluence', name: 'Confluence / BRD / FRD documents', mvp: 'platform only' },
  { id: 'api-contract', name: 'API contracts (OpenAPI)', mvp: 'platform only' },
  { id: 'existing-tests', name: 'Existing test suites (Zephyr / Xray)', mvp: 'platform only' },
  { id: 'defect-history', name: 'Defect and incident history', mvp: 'platform only' },
  { id: 'ui-design', name: 'UI designs (Figma)', mvp: 'platform only' },
  { id: 'regulatory', name: 'Policy and contract documents (e.g. commission agreements)', mvp: 'platform only' },
];

const DEMO = {
  capability: 'Travel-advisor commission calculated from reservation attributes',
  system: 'Aurora Hotels commission engine',
  reservationAttributes: 1000,
  flow1: 'COM-1 initiative + COM-10 epic (with story COM-11) + codebase branch demo/commission-engine (release 1.0). Conflict to settle: GDS uplift 2% in Jira vs 1.5% in code. Real defect: a stay of exactly 7 nights gets no long-stay bonus (code checks > 7).',
  flow2: 'COM-20 epic + codebase branch demo/commission-engine-v2 (release 2.0). Enhanced: cap USD 500 -> USD 750. New: group flat 8% for 10+ rooms, package commission on 70% of the price (Jira only), corporate flat 5% (code only).',
};

module.exports = { SEVEN_AGENTS, INTAKE_STAGES, INPUT_TYPES, DEMO };
