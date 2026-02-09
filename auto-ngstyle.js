const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TICKETS_URL = 'https://www.wbstudiotour.jp/en/tickets/';
const OUT_FILE = path.join(__dirname, 'wbst-feb-2026-ngstyle-auto.json');
const TEST_JS = fs.readFileSync(path.join(__dirname, 'test.js'), 'utf8');

function parseLabelDate(label) {
  const m = String(label || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, '0');
  const dd = m[2].padStart(2, '0');
  return `${m[3]}-${mm}-${dd}`;
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log('Starting automation');

  let browser;
  let context;
  let closeBrowser = true;
  try {
    const cdpUrl = process.env.PW_CDP || 'http://localhost:9222';
    browser = await withTimeout(chromium.connectOverCDP(cdpUrl), 5000, 'CDP connect');
    context = browser.contexts()[0] || await browser.newContext();
    closeBrowser = false;
    console.log(`Connected over CDP: ${cdpUrl}`);
  } catch (_) {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    context = await browser.newContext();
  }

  const page = await context.newPage();
  try {
    await page.goto(TICKETS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (_) {
    //继续等待页面元素出现
  }

  const buyLink = page.getByRole('link', { name: 'BUY TICKETS' }).first();
  await buyLink.waitFor({ timeout: 60000 });

  //清理可能阻塞点击的弹层
  await page.evaluate(() => {
    const sdk = document.querySelector('#onetrust-consent-sdk');
    if (sdk) sdk.remove();
    const mask = document.querySelector('.onetrust-pc-dark-filter');
    if (mask) mask.remove();
  });

  const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await buyLink.click({ force: true });

  let shop = await popupPromise;
  if (shop) {
    await shop.waitForLoadState('domcontentloaded');
  } else {
    await page.waitForURL(new RegExp('tickets\\.wbstudiotour\\.jp/webstore/'), { timeout: 20000 });
    shop = page;
  }

  const adultPlus = shop.locator('button[aria-label*="Increase quantity for  ADULT"], button[aria-label*="Increase quantity for ADULT"]');
  await adultPlus.first().waitFor({ timeout: 60000 });
  await adultPlus.first().click();

  const continueBtn = shop.getByRole('button', { name: 'Continue To Calendar' });
  await continueBtn.waitFor({ timeout: 60000 });
  await continueBtn.click();
  await shop.waitForLoadState('networkidle');

  const runTestJs = async () => {
    return shop.evaluate((code) => {
      try {
        return { ok: true, data: eval(code) };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, TEST_JS);
  };

  const getNgStyleLabels = async () => {
    return shop.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[ng-style]'))
        .filter((el) => (el.getAttribute('ng-style') || '').includes('priceProgramColor'));
      const labels = els
        .map((el) => el.closest('[role=button]')?.getAttribute('aria-label')?.trim() || null)
        .filter(Boolean);
      const seen = new Set();
      return labels.filter((l) => {
        if (seen.has(l)) return false;
        seen.add(l);
        return true;
      });
    });
  };

  //先点击第一个 ng-style 元素，触发组件初始化
  let attempts = 0;
  let testResult = null;
  while (attempts < 5) {
    await shop.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[ng-style]'))
        .find((n) => (n.getAttribute('ng-style') || '').includes('priceProgramColor'));
      const btn = el && el.closest('[role=button]');
      if (btn) btn.click();
    });
    await shop.waitForTimeout(300);

    testResult = await runTestJs();
    if (testResult.ok && Array.isArray(testResult.data) && testResult.data.length > 0) break;
    attempts += 1;
  }
  if (!testResult || !testResult.ok || !Array.isArray(testResult.data) || testResult.data.length === 0) {
    throw new Error('test.js failed after retries');
  }

  const labels = await getNgStyleLabels();
  const ordered = labels
    .map((l) => ({ label: l, date: parseLabelDate(l) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const results = [];
  for (const item of ordered) {
    await shop.evaluate((lbl) => {
      const btn = Array.from(document.querySelectorAll('[role=button][aria-label]'))
        .find((el) => (el.getAttribute('aria-label') || '').trim() === lbl);
      if (btn) btn.click();
    }, item.label);

    let data = [];
    for (let i = 0; i < 20; i += 1) {
      const res = await runTestJs();
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        data = res.data;
        break;
      }
      await shop.waitForTimeout(200);
    }

    results.push({
      date: item.date,
      rawLabel: item.label,
      items: data
    });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Saved ${results.length} dates to ${OUT_FILE}`);

  if (closeBrowser) {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
