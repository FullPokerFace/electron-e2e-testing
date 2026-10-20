const { chromium } = require('playwright');
const path = require('node:path');
const { runSuite } = require('./run-suite');
let browser;
let stopping = false;
const send = message => process.parentPort.postMessage(message);
process.parentPort.on('message', async ({ data }) => {
  if (data.stop) {
    stopping = true;
    if (browser) await browser.close();
    process.exit(0);
  }
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ baseURL: data.environment.baseUrl });
    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(30000);
    await runSuite({ context, ...data, send });
    send({ type: 'complete' });
    // Keep the website visible for inspection until the user closes the browser.
    browser.on('disconnected', () => process.exit(0));
    if (!browser.isConnected()) process.exit(0);
  } catch (error) {
    send({ type: 'error', error: error.message });
    if (browser) await browser.close();
    process.exit(1);
  }
});
