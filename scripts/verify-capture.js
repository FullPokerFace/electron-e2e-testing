const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '..', 'browsers');
const { chromium } = require('playwright');
const { runSuite } = require('../src/run-suite');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-check-'));
  const browser = await chromium.launch({ headless: true });
  try {
    await fs.writeFile(path.join(root, 'test.js'), "module.exports = async ({page}) => { await page.setContent('<h1>Screenshot verification</h1>'); };");
    await fs.writeFile(path.join(root, 'fail.js'), "module.exports = async ({page}) => { await page.setContent('<h1>Failed test</h1>'); throw Error('Expected fixture failure'); };");
    const context = await browser.newContext();
    const messages = [];
    const outputDir = path.join(root, 'screenshots');
    const running = runSuite({ context, team: {name:'Verification', tests:[{id:'one', name:'First', file:'test.js'}, {id:'two', name:'Second', file:'fail.js'}]}, environment:{name:'Local', baseUrl:'https://example.com'}, contentRoot:root, outputDir, send: message => messages.push(message) });
    // Attach a handler immediately so failures cannot become unhandled rejections.
    const completed = running.then(() => null, error => error);
    for (let index = 0; index < 2; index++) {
      while (!messages.some(message => message.type === 'awaiting-capture' && message.id === (index ? 'two' : 'one'))) {
        const error = await Promise.race([completed, new Promise(resolve => setTimeout(() => resolve(false), 50))]);
        if (error !== false) throw error || Error('Suite finished before capture');
      }
      assert.equal(messages.filter(message => message.type === 'test' && message.status === 'Running').length, index + 1);
      const page = context.pages()[0];
      const button = page.getByRole('button');
      const box = await button.boundingBox();
      assert.ok(box.x < 30 && box.y > 600, 'Overlay should be bottom left');
      if (index === 0) {
        const screenshot = page.screenshot.bind(page);
        page.screenshot = async () => { page.screenshot = screenshot; throw Error('Simulated disk failure'); };
      }
      await button.click();
      if (index === 0) {
        await page.getByRole('button', {name:'Screenshot failed — retry'}).waitFor();
        assert.equal(context.pages().length, 1);
        await page.getByRole('button', {name:'Screenshot failed — retry'}).click();
      }
      while (!messages.some(message => message.type === 'captured' && message.id === (index ? 'two' : 'one'))) {
        const error = await Promise.race([completed, new Promise(resolve => setTimeout(() => resolve(false), 50))]);
        if (error !== false && !messages.some(message => message.type === 'captured' && message.id === (index ? 'two' : 'one'))) throw error || Error('Capture did not finish');
      }
    }
    const error = await completed;
    if (error) throw error;
    const report = JSON.parse(await fs.readFile(path.join(outputDir, 'report.json'), 'utf8'));
    assert.equal(report.tests.length, 2);
    for (const test of report.tests) {
      assert.equal(test.status, test.id === 'one' ? 'Passed' : 'Failed');
      const png = await fs.readFile(path.join(outputDir, test.screenshot));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
    }
    assert.ok((await fs.readFile(path.join(outputDir, 'report.html'), 'utf8')).includes('001-one.png'));
    console.log('Verified: bottom-left overlay, pause before next test, capture failure/retry, passed/failed test screenshots, JSON/HTML reports.');
  } finally {
    await browser.close();
    await fs.rm(root, {recursive:true, force:true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
