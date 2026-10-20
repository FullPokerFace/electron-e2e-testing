const { app, BrowserWindow, ipcMain, utilityProcess, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
let window;
let runner;
let catalog;
let contentRoot;
let reportFolder;

function loadCatalog() {
  const external = path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe')), 'test-content');
  contentRoot = app.isPackaged && fs.existsSync(path.join(external, 'catalog.json'))
    ? external : path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'test-content');
  const data = JSON.parse(fs.readFileSync(path.join(contentRoot, 'catalog.json'), 'utf8'));
  if (data.schemaVersion !== 1 || !data.teams?.length || !data.environments?.length) throw new Error('Invalid test catalog.');
  for (const env of data.environments) {
    if (!['https:', 'http:'].includes(new URL(env.baseUrl).protocol)) throw new Error('Invalid environment URL.');
  }
  for (const team of data.teams) {
    if (!Array.isArray(team.tests)) throw new Error('Team tests must be a list.');
    for (const test of team.tests) {
      const relative = path.relative(contentRoot, path.resolve(contentRoot, test.file));
      if (path.isAbsolute(test.file) || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(path.join(contentRoot, test.file))) throw new Error(`Invalid test file: ${test.file}`);
    }
  }
  return data;
}

app.whenReady().then(() => {
  ipcMain.handle('open-artifact', async (_event, kind) => {
    if (!reportFolder || !['report', 'folder'].includes(kind)) throw new Error('No report available.');
    const error = await shell.openPath(kind === 'report' ? path.join(reportFolder, 'report.html') : reportFolder);
    if (error) throw new Error(error);
  });
  ipcMain.handle('catalog', () => {
    if (runner) throw new Error('Wait for the current run to finish.');
    catalog = loadCatalog();
    return catalog;
  });
  ipcMain.handle('run', (_event, selection) => {
    if (runner) throw new Error('A run is already active.');
    const team = catalog?.teams.find(item => item.id === selection.teamId);
    const environment = catalog?.environments.find(item => item.id === selection.environmentId);
    if (!team || !environment || !team.tests.length) throw new Error('Select a valid team and environment.');
    reportFolder = null;
    const outputDir = path.join(app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..'), 'screenshots', `${new Date().toISOString().replace(/[:.]/g, '-')}-${require('node:crypto').randomUUID()}`);
    const child = utilityProcess.fork(path.join(__dirname, 'runner.js'), [], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'browsers') }
    });
    runner = child;
    child.on('message', message => {
      if (message.type === 'report') reportFolder = outputDir;
      if (!window.isDestroyed()) window.webContents.send('progress', message);
    });
    child.on('exit', code => {
      runner = null;
      if (!window.isDestroyed()) window.webContents.send('progress', { type: 'exit', code });
    });
    child.postMessage({ team, environment, contentRoot, outputDir });
  });
  window = new BrowserWindow({ width: 800, height: 650, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => {
    if (runner) {
      event.preventDefault();
      runner.postMessage({ stop: true });
      runner.once('exit', () => window.close());
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
