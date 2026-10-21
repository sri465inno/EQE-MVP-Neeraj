'use strict';
// Requirements intake agent: reads the initiative, its epics and their stories from Jira (REST v3).
const jira = require('../jira');

module.exports = async function intake(run, { log, progress = () => {} }) {
  const { initiative } = run.config;
  log(`Reading initiative ${initiative} from ${jira.JIRA_URL}`);
  const init = await jira.issue(initiative);
  const epics = await jira.search(`parent = ${initiative} AND issuetype = Epic ORDER BY key`);
  log(`Found ${epics.length} epics: ${epics.map((e) => e.key).join(', ')}`);
  const stories = [];
  for (const [i, e] of epics.entries()) {
    progress(10 + (80 * i) / epics.length, `Reading epic ${i + 1} of ${epics.length} (${e.key})`);
    const children = await jira.search(`parent = ${e.key} AND issuetype in (Story, Task) ORDER BY key`);
    for (const s of children) {
      const d = jira.parseDescription(s.fields.description);
      stories.push({
        key: s.key, summary: s.fields.summary, epicKey: e.key, epicSummary: e.fields.summary,
        priority: s.fields.priority?.name || 'Medium', status: s.fields.status?.name, labels: s.fields.labels || [],
        text: d.text, ac: d.ac.map((t, i) => ({ id: `${s.key}-AC${i + 1}`, text: t })), testData: d.testData,
      });
    }
    log(`${e.key} ${e.fields.summary}: ${children.length} stories`);
  }
  const acCount = stories.reduce((n, s) => n + s.ac.length, 0);
  run.requirements = {
    source: jira.JIRA_URL, readAt: new Date().toISOString(),
    initiative: { key: init.key, summary: init.fields.summary, text: jira.parseDescription(init.fields.description).text, priority: init.fields.priority?.name },
    epics: epics.map((e) => ({ key: e.key, summary: e.fields.summary, priority: e.fields.priority?.name, stories: stories.filter((s) => s.epicKey === e.key).map((s) => s.key) })),
    stories,
  };
  if (!stories.length) throw new Error(`No stories found under ${initiative}`);
  return `${epics.length} epics · ${stories.length} stories · ${acCount} acceptance criteria`;
};
