'use strict';
// Structured output contract for one EQE cycle session (JSON Schema Draft 7, self-contained).
// The session fills one section per agent and re-submits the whole object after every stage.
const S = { type: 'string' };
const I = { type: 'integer' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const en = (...v) => ({ type: 'string', enum: v });
const strMap = { type: 'object', additionalProperties: { type: 'string' } };

const PHASES = ['starting', 'intake', 'analysis', 'design', 'awaiting_test_approval', 'scripts', 'execution', 'awaiting_execution_review', 'reporting', 'done', 'failed'];
const STAGES = ['search', 'results', 'hotel', 'member', 'booking', 'find', 'account', 'unknown'];
const TESTABILITY = ['Testable', 'Ambiguous', 'Not UI-observable', 'Needs human design'];
const TRIAGE = ['product-defect', 'script-issue', 'environment', 'test-data', 'requirement-gap'];

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'EQE cycle output',
  type: 'object',
  additionalProperties: false,
  required: ['protocol', 'phase'],
  properties: {
    protocol: { type: 'string', const: 'eqe-cycle/1' },
    phase: en(...PHASES),
    app: obj({ url: S, release: S, ready: { type: 'boolean' } }),
    log: arr(obj({ stage: S, level: en('info', 'warn', 'error'), msg: S }, ['msg'])),
    intake: obj({
      summary: S,
      stories: arr(obj({ key: S, summary: S, epicKey: S, priority: S, text: S, ac: arr(obj({ id: S, text: S }, ['id', 'text'])), testData: strMap }, ['key', 'summary', 'ac'])),
      gaps: arr(obj({ storyKey: S, text: S }, ['text'])),
    }, ['stories']),
    analysis: obj({
      summary: S,
      stories: arr(obj({
        key: S, stage: en(...STAGES), stageLabel: S, risk: en('High', 'Medium', 'Low'), riskReason: S,
        qualityScore: { type: 'integer', minimum: 0, maximum: 100 },
        findings: arr(obj({ level: en('high', 'medium', 'low'), text: S }, ['level', 'text'])),
        questions: arr(S),
        acs: arr(obj({ id: S, technique: S, kind: en('journey', 'variant', 'negative', 'manual'), testability: en(...TESTABILITY), issues: arr(S), reason: S }, ['id', 'technique', 'kind', 'testability'])),
      }, ['key', 'risk', 'qualityScore', 'acs'])),
    }, ['stories']),
    design: obj({
      summary: S,
      testCases: arr(obj({
        id: { type: 'string', pattern: '^TC-\\d{3}$' }, title: S, type: S, automation: en('Automation', 'Manual'), priority: en('P1', 'P2', 'P3'),
        acIds: arr(S), storyKeys: arr(S), preconditions: S, data: strMap,
        steps: arr(obj({ n: I, action: S, expected: S }, ['n', 'action'])),
        rationale: S, needsClarification: { type: 'boolean' },
      }, ['id', 'title', 'type', 'automation', 'priority', 'acIds', 'steps'])),
      uncovered: arr(obj({ acId: S, reason: S }, ['acId'])),
    }, ['testCases']),
    scripts: obj({
      summary: S,
      cases: arr(obj({ tcId: S, file: S, status: en('generated', 'needs-attention'), issues: arr(S), explorationTool: en('playwright-mcp', 'browser'), mcpCalls: I, explorationMs: I, steps: arr(obj({ n: I, resolvedTo: S, locator: S, observed: S }, ['n'])) }, ['tcId', 'file', 'status'])),
      pageObjects: arr(obj({ class: S, file: S, locators: arr(obj({ prop: S, locator: S }, ['prop', 'locator'])) }, ['class', 'file'])),
    }, ['cases']),
    execution: obj({
      summary: S, passed: I, failed: I, skipped: I, durationMs: I,
      results: arr(obj({
        tcId: S, status: en('passed', 'failed', 'skipped'), durationMs: I, failedStep: S, error: S,
        triage: obj({ category: en(...TRIAGE), confidence: en('high', 'medium', 'low'), rationale: S, suggestedFix: S, raiseDefect: { type: 'boolean' } }, ['category', 'raiseDefect']),
      }, ['tcId', 'status'])),
    }, ['passed', 'failed', 'results']),
    reporting: obj({
      executiveSummary: S,
      recommendation: obj({ decision: en('Go', 'Conditional', 'No-go'), reasons: arr(S) }, ['decision']),
      defects: arr(obj({ tcId: S, title: S, severity: en('Critical', 'High', 'Medium', 'Low'), summary: S, stepsToReproduce: arr(S), expected: S, actual: S, rootCause: S, storyKeys: arr(S), acIds: arr(S) }, ['tcId', 'title'])),
      risks: arr(S),
    }, ['executiveSummary']),
    artifacts: obj({ automationZip: S, notes: S }),
    error: S,
  },
};

module.exports = { schema, PHASES, STAGES, TESTABILITY, TRIAGE };
