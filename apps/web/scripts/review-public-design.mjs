import { chromium } from 'playwright';
import fs from 'node:fs';
(async () => {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('.runtime', { recursive: true });
  const result = [];
  const data = await (await fetch('http://127.0.0.1:8000/v1/incidents')).json();
  const routes = ['/', '/map', '/incidents', '/incidents/new', '/scan', ...(data[0] ? ['/incidents/' + data[0].id] : [])];
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(t => localStorage.setItem('ruas-theme', t), theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const [index, route] of routes.entries()) {
        await page.goto('http://127.0.0.1:3000' + route);
        await page.locator('h1').waitFor();
        await page.waitForTimeout(1300);
        const loading = page.getByText('Memuat latar peta…', { exact: true });
        if (await loading.count()) await loading.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
        const geometry = await page.evaluate(() => ({
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
          theme: document.querySelector('.rk-public-root').className,
          markers: document.querySelectorAll('.rk-geo-marker').length,
        }));
        await page.screenshot({ path: `.runtime/review-${index}-${theme}-${width}.png`, fullPage: true });
        result.push({ theme, route, ...geometry, errors: [...errors] });
      }
      await context.close();
    }
  }
  fs.writeFileSync('.runtime/design-review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
