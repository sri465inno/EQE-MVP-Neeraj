'use strict';
// Loads the inputs of a run into statements with honest provenance.
const { loadJiraIssue } = require('./connectors/jira');
const { loadCodebaseFixture, loadCodebaseLive, DEFAULT_BRANCH } = require('./connectors/codebase');
const x = require('./extract');

const SLOT_LABEL = { initiative: 'Jira initiative', epic: 'Jira epic', codebase: 'Codebase' };

async function loadInput(slot, spec, opts = {}) {
  if (!spec || spec.mode === 'none') return null;
  if (slot === 'codebase') {
    if (spec.mode === 'paste') {
      const statements = x.statementsFromPastedCodebase(spec.text, { input: slot });
      return { slot, label: SLOT_LABEL[slot], mode: 'paste', ref: 'pasted README / source notes', statements,
        provenance: { kind: 'pasted', label: 'Pasted by the user (not fetched from any system)' }, branch: null };
    }
    const branch = spec.branch || DEFAULT_BRANCH;
    const cb = spec.mode === 'github' ? await loadCodebaseLive(branch, { cloneUrl: opts.cloneUrl }) : loadCodebaseFixture(branch);
    return { slot, label: SLOT_LABEL[slot], mode: spec.mode === 'github' ? 'github' : 'sample', ref: cb.provenance.ref, statements: x.statementsFromCodebase(cb, { input: slot }),
      provenance: cb.provenance, branch: cb.branch, repo: cb.repo, commit: cb.commit, compare: cb.compare, description: cb.description, dataModel: cb.dataModel };
  }
  if (spec.mode === 'paste') {
    const statements = x.statementsFromPastedJira(spec.text, { input: slot });
    return { slot, label: SLOT_LABEL[slot], mode: 'paste', ref: `pasted ${SLOT_LABEL[slot]}`, statements,
      provenance: { kind: 'pasted', label: 'Pasted by the user (not fetched from any system)' } };
  }
  const loaded = await loadJiraIssue(spec.key, { withChildren: slot === 'epic', source: spec.mode === 'github' ? 'github' : 'jira', ...opts });
  const issues = [loaded.issue, ...loaded.children];
  const statements = issues.flatMap((iss) => x.statementsFromIssue(iss, { baseUrl: loaded.baseUrl, input: slot }));
  return { slot, label: SLOT_LABEL[slot], mode: spec.mode === 'github' ? 'github' : 'jira', ref: loaded.issue.key, summary: loaded.issue.fields.summary,
    children: loaded.children.map((c) => c.key), statements, provenance: loaded.provenance };
}

async function loadInputs(specs, slots, opts) {
  const out = [];
  for (const slot of slots) {
    const loaded = await loadInput(slot, specs[slot], opts);
    if (loaded) out.push(loaded);
  }
  return out;
}

module.exports = { loadInputs, loadInput, SLOT_LABEL };
