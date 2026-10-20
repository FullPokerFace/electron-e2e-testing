module.exports = async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // A fresh run may already be logged out.
  const logout = page.getByRole('button', { name: 'logout', exact: true });
  await page.getByPlaceholder('Email').or(logout).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(2000);
  if (await logout.isVisible()) await logout.click();
  await page.getByPlaceholder('Email').fill('123456@');
  await page.getByPlaceholder('Password').fill('123456@');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).click();
  await page.getByPlaceholder('Email').fill('support@resumefromspace.com');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(4).click();
  await page.getByPlaceholder('Password').fill('12345@');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
};
