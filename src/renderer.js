const team = document.getElementById('team');
const environment = document.getElementById('environment');
const run = document.getElementById('run');
const reload = document.getElementById('reload');
const status = document.getElementById('status');
const errors = document.getElementById('errors');
const reportButton = document.getElementById('report');
const screenshotsButton = document.getElementById('screenshots');
for (const [button, kind] of [[reportButton, 'report'], [screenshotsButton, 'folder']]) {
  button.addEventListener('click', async () => {
    try { await window.testRunner.openArtifact(kind); }
    catch (error) { errors.textContent += `${error.message}\n`; }
  });
}
let catalog;
const rows = new Map();
function showTests() {
  rows.clear();
  document.getElementById('tests').replaceChildren();
  const tests = catalog.teams.find(item => item.id === team.value)?.tests || [];
  for (const test of tests) {
    const row = document.createElement('li');
    row.textContent = `${test.name} — Ready`;
    rows.set(test.id, { row, name: test.name });
    document.getElementById('tests').append(row);
  }
  run.disabled = !tests.length;
}
function showUrl() {
  document.getElementById('url').textContent = catalog.environments.find(item => item.id === environment.value)?.baseUrl || '';
}
function busy(value) {
  team.disabled = environment.disabled = reload.disabled = value;
  run.disabled = value || !rows.size;
}
async function load() {
  busy(true);
  errors.textContent = '';
  try {
    catalog = await window.testRunner.catalog();
    team.replaceChildren(...catalog.teams.map(item => new Option(item.name, item.id)));
    environment.replaceChildren(...catalog.environments.map(item => new Option(item.name, item.id)));
    showTests();
    showUrl();
    busy(false);
    status.textContent = 'Ready. All listed tests will run in a visible browser.';
  } catch (error) {
    status.textContent = 'Unable to load test content.';
    errors.textContent = error.message;
    reload.disabled = false;
  }
}
team.addEventListener('change', showTests);
environment.addEventListener('change', showUrl);
reload.addEventListener('click', load);
run.addEventListener('click', async () => {
  showTests();
  busy(true);
  errors.textContent = '';
  status.textContent = 'Opening browser...';
  reportButton.disabled = screenshotsButton.disabled = true;
  document.getElementById('artifact-path').textContent = 'Preparing run folder...';
  try { await window.testRunner.run({ teamId: team.value, environmentId: environment.value }); }
  catch (error) { errors.textContent = error.message; status.textContent = 'Unable to start tests.'; busy(false); }
});
window.testRunner.onProgress(message => {
  if (message.type === 'report') {
    reportButton.disabled = screenshotsButton.disabled = false;
    document.getElementById('artifact-path').textContent = message.folder;
  }
  if (message.type === 'awaiting-capture') status.textContent = 'Review the website, then use the bottom-left browser button to save a screenshot and continue.';
  if (message.type === 'captured') status.textContent = 'Screenshot saved.';
  if (message.type === 'test') {
    const item = rows.get(message.id);
    if (item) item.row.textContent = `${item.name} — ${message.status}`;
    status.textContent = 'Running tests...';
    if (message.error) errors.textContent += `${item?.name || message.id}: ${message.error}\n`;
  }
  if (message.type === 'complete') status.textContent = 'Tests finished. Close the browser when you are done inspecting the website.';
  if (message.type === 'error') errors.textContent += `${message.error}\n`;
  if (message.type === 'exit') {
    status.textContent = message.code ? 'Run ended with an error. See details below.' : 'Browser closed. Ready to run again.';
    busy(false);
  }
});
load();
