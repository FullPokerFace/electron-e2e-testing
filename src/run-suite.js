const fs = require('node:fs/promises');
const path = require('node:path');

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function runSuite({ context, team, environment, contentRoot, outputDir, send }) {
  await fs.mkdir(outputDir, { recursive: true });
  const report = { team: team.name, environment: environment.name, baseUrl: environment.baseUrl, startedAt: new Date().toISOString(), tests: [] };
  async function saveReport() {
    await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self';"><title>Test report</title><h1>Test report</h1><p>Team: ${escape(report.team)}</p><p>Environment: ${escape(report.environment)} — ${escape(report.baseUrl)}</p><p>Started: ${escape(report.startedAt)}</p>${report.tests.map(test => `<section><h2>${escape(test.name)} — ${escape(test.status)}</h2><p>${escape(test.error)}</p><p>${escape(test.captureError)}</p>${test.screenshot ? `<p><a href="${escape(test.screenshot)}">Open screenshot</a></p><img src="${escape(test.screenshot)}" width="800" alt="${escape(test.name)} screenshot">` : '<p>No screenshot saved.</p>'}</section>`).join('')}</html>`;
    await fs.writeFile(path.join(outputDir, 'report.html'), html);
    send({ type: 'report', folder: outputDir });
  }
  await saveReport();
  for (const [index, test] of team.tests.entries()) {
    const result = { id: test.id, name: test.name, status: 'Running', startedAt: new Date().toISOString() };
    report.tests.push(result);
    const page = await context.newPage();
    send({ type: 'test', id: test.id, status: 'Running' });
    try {
      await require(path.join(contentRoot, test.file))({ page });
      result.status = 'Passed';
    } catch (error) {
      result.status = 'Failed';
      result.error = error.message;
    }
    result.finishedAt = new Date().toISOString();
    send({ type: 'test', id: test.id, status: result.status, error: result.error });
    await saveReport();
    try {
      const overlayId = `test-runner-${require('node:crypto').randomUUID()}`;
      const label = index === team.tests.length - 1 ? 'Save screenshot and finish' : 'Save screenshot and go to next test';
      await page.evaluate(({ overlayId, label }) => {
        const host = document.createElement('div');
        host.id = overlayId;
        host.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:2147483647;';
        const root = host.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = 'font:16px Arial;padding:12px;color:black;background:white;border:2px solid black;cursor:pointer';
        button.addEventListener('click', () => { host.dataset.advance = 'yes'; button.disabled = true; });
        root.append(button);
        document.documentElement.append(host);
      }, { overlayId, label });
      send({ type: 'awaiting-capture', id: test.id });
      while (true) {
        await page.waitForFunction(id => document.getElementById(id)?.dataset.advance === 'yes', overlayId, { timeout: 0 });
        try {
          await page.evaluate(id => { document.getElementById(id).style.visibility = 'hidden'; }, overlayId);
          const filename = `${String(index + 1).padStart(3, '0')}-${test.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          await page.screenshot({ path: path.join(outputDir, filename), fullPage: true, timeout: 30000 });
          result.screenshot = filename;
          delete result.captureError;
          await page.evaluate(id => document.getElementById(id)?.remove(), overlayId);
          break;
        } catch (error) {
          result.captureError = error.message;
          await saveReport();
          send({ type: 'error', error: `Screenshot failed: ${error.message}. Use the browser button to retry.` });
          await page.evaluate(id => {
            const host = document.getElementById(id);
            host.style.visibility = 'visible';
            delete host.dataset.advance;
            const button = host.shadowRoot.querySelector('button');
            button.textContent = 'Screenshot failed — retry';
            button.disabled = false;
          }, overlayId);
        }
      }
      await saveReport();
      send({ type: 'captured', id: test.id });
    } catch (error) {
      result.captureError = `Capture interrupted: ${error.message}`;
      await saveReport();
      throw new Error('Browser or test page closed before the screenshot was saved. Partial report is available.');
    }
    if (index < team.tests.length - 1) await page.close();
  }
  report.finishedAt = new Date().toISOString();
  await saveReport();
}

module.exports = { runSuite };
