module.exports = async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) {
    throw new Error(`Website returned ${response ? response.status() : 'no response'}.`);
  }
};
