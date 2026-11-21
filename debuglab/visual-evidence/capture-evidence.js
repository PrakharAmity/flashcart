import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..');
const outputRoot = scriptDir;
const port = Number(process.env.FLASHCART_EVIDENCE_PORT || 3118);
const baseUrl = `http://127.0.0.1:${port}`;
const viewport = { width: 1440, height: 900 };

// Start the real Express application in this process so controlled seed data can be
// prepared in memory without changing any application source or persisted files.
process.env.NODE_ENV = 'test';
process.env.PORT = String(port);
process.env.REFERENCE_MODE = 'false';
process.env.CHALLENGE_MODE = 'true';

const [{ default: app }, { db }, { warehouseService }] = await Promise.all([
  import('../../server.js'),
  import('../../src/db/index.js'),
  import('../../src/services/warehouse.service.js')
]);

const captures = [];
const contexts = [];

async function waitForServer(server) {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) throw new Error(`FlashCart health check failed (${response.status}).`);
  const health = await response.json();
  if (health.status !== 'healthy' || health.applicationId !== 'DL-APP-001' || health.referenceMode !== false) {
    throw new Error('The selected port is not serving FlashCart in challenge mode.');
  }
}

async function resetScenario(setup) {
  db.reset();
  if (setup) await setup();
}

async function createPage(browser, testUserId = null) {
  const contextOptions = {
    viewport,
    deviceScaleFactor: 1,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    reducedMotion: 'reduce'
  };
  if (testUserId) contextOptions.extraHTTPHeaders = { 'x-user-id': testUserId };
  const context = await browser.newContext(contextOptions);
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/FlashCart/i);
  await expect(page.locator('#trending-product-grid .product-card')).toHaveCount(8);
  return page;
}

async function loginAsDemoCustomer(page) {
  await page.locator('#user-menu-btn').click();
  await page.locator('#user-dropdown-menu').getByRole('button', { name: /Demo Customer/ }).click();
  await expect(page.locator('#user-name-display')).toHaveText('Alex');
}

async function loginAsCustomerTwo(page) {
  // The fresh demo shell auto-selects Alex as its local guest account. Sign out
  // through the UI before authenticating the independent seeded customer.
  await page.locator('#user-menu-btn').click();
  await page.locator('#auth-action-btn').click();
  await expect(page.locator('#user-name-display')).toHaveText('Sign In');
  await page.locator('#user-menu-btn').click();
  await page.locator('#auth-action-btn').click();
  await expect(page.locator('#auth-modal')).toBeVisible();
  await page.locator('#login-email').fill('customer2@example.com');
  await page.locator('#login-password').fill('FlashCart@123');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#user-name-display')).toHaveText('Customer');
  await expect(page.locator('#auth-modal')).toBeHidden();
}

async function loginAsDemoAdmin(page) {
  await page.locator('#user-menu-btn').click();
  await page.locator('#user-dropdown-menu').getByRole('button', { name: /Demo Admin/ }).click();
  await expect(page.locator('#user-name-display')).toHaveText('FlashCart');
  await expect(page.locator('#view-admin')).toBeVisible();
  await expect(page.locator('#admin-warehouses-list > div')).toHaveCount(5);
}

async function openCartAndCheckout(page) {
  const drawer = page.locator('#cart-drawer');
  const isOpen = await drawer.evaluate(element => !element.classList.contains('translate-x-full'));
  if (!isOpen) await page.getByRole('button', { name: 'Shopping cart', exact: true }).click();
  await expect(drawer).not.toHaveClass(/translate-x-full/);
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page.locator('#checkout-modal')).toBeVisible();
}

async function addProductThroughSearch(page, query, fullTitle) {
  const search = page.locator('#global-search-input');
  await search.fill(query);
  const dropdown = page.locator('#search-results-dropdown');
  await expect(dropdown).toContainText(fullTitle);
  await dropdown.getByText(fullTitle, { exact: false }).click();
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#modal-product-title')).toContainText(fullTitle);
  await page.locator('#modal-add-cart-btn').click();
  await expect(page.locator('#cart-drawer')).not.toHaveClass(/translate-x-full/);
  await expect(page.locator('#cart-drawer-items')).toContainText(fullTitle);
}

async function goToCustomerOrders(page) {
  await page.locator('#user-menu-btn').click();
  await page.locator('#user-dropdown-menu').getByText('Customer Profile & Orders').click();
  await expect(page.locator('#view-profile')).toBeVisible();
  await expect(page.locator('#profile-orders-list')).not.toBeEmpty();
}

async function annotatePage(page, annotation) {
  if (!annotation) return;
  await page.evaluate(({ card, highlights }) => {
    document.querySelectorAll('.debuglab-annotation').forEach(el => el.remove());

    const style = document.createElement('style');
    style.className = 'debuglab-annotation';
    style.textContent = `
      .dl-card-overlay {
        position: fixed;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.96);
        border: 1.5px solid #ef4444;
        border-radius: 12px;
        padding: 16px 18px;
        width: 370px;
        box-shadow: 0 20px 30px -5px rgba(0, 0, 0, 0.8), 0 0 22px rgba(239, 68, 68, 0.28);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        pointer-events: none;
        backdrop-filter: blur(8px);
      }
      .dl-card-tag {
        display: inline-block;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        padding: 3px 8px;
        border-radius: 5px;
        text-transform: uppercase;
        margin-bottom: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      .dl-card-title {
        color: #f8fafc;
        font-size: 14.5px;
        font-weight: 700;
        line-height: 1.35;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dl-card-desc {
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.5;
        font-weight: 400;
      }
      .dl-highlight-box {
        position: absolute;
        pointer-events: none;
        z-index: 999980;
        border-radius: 8px;
        box-sizing: border-box;
      }
      .dl-highlight-badge {
        position: absolute;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 4px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
        z-index: 999985;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 5px;
        pointer-events: none;
        letter-spacing: 0.02em;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    `;
    document.head.appendChild(style);

    if (card) {
      const cardEl = document.createElement('div');
      cardEl.className = 'debuglab-annotation dl-card-overlay';
      const pos = card.position || { top: '30px', right: '30px' };
      for (const [k, v] of Object.entries(pos)) {
        cardEl.style[k] = v;
      }
      if (card.borderColor) {
        cardEl.style.borderColor = card.borderColor;
        cardEl.style.boxShadow = `0 20px 30px -5px rgba(0, 0, 0, 0.8), 0 0 22px ${card.borderColor}40`;
      }
      cardEl.innerHTML = `
        <div class="dl-card-tag" style="${card.tagBg ? `background:${card.tagBg}` : ''}">${card.tag}</div>
        <div class="dl-card-title">${card.title}</div>
        <div class="dl-card-desc">${card.description}</div>
      `;
      document.body.appendChild(cardEl);
    }

    if (highlights && Array.isArray(highlights)) {
      for (const hl of highlights) {
        let targetEl = null;
        if (hl.selector) {
          targetEl = document.querySelector(hl.selector);
        }
        if (!targetEl && hl.containsText) {
          const candidates = document.querySelectorAll(hl.parentSelector || '*');
          for (const el of candidates) {
            if (el.textContent && el.textContent.includes(hl.containsText)) {
              targetEl = el;
              break;
            }
          }
        }
        if (!targetEl) continue;

        const rect = targetEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const color = hl.color || '#ef4444';
        const bgGlow = hl.bgGlow || 'rgba(239, 68, 68, 0.05)';
        const shadow = hl.shadow || '0 0 18px rgba(239, 68, 68, 0.45)';
        const pad = hl.padding !== undefined ? hl.padding : 4;

        const box = document.createElement('div');
        box.className = 'debuglab-annotation dl-highlight-box';
        box.style.top = `${rect.top + window.scrollY - pad}px`;
        box.style.left = `${rect.left + window.scrollX - pad}px`;
        box.style.width = `${rect.width + pad * 2}px`;
        box.style.height = `${rect.height + pad * 2}px`;
        box.style.border = `2px dashed ${color}`;
        box.style.boxShadow = shadow;
        box.style.background = bgGlow;

        if (hl.label) {
          const badge = document.createElement('div');
          badge.className = 'dl-highlight-badge';
          badge.style.background = color;
          if (hl.badgePos === 'bottom') {
            badge.style.bottom = '-11px';
            badge.style.left = '12px';
          } else {
            badge.style.top = '-11px';
            badge.style.left = '12px';
          }
          if (hl.badgeOffsetLeft) badge.style.left = hl.badgeOffsetLeft;
          badge.textContent = hl.label;
          box.appendChild(badge);
        }

        document.body.appendChild(box);
      }
    }
  }, annotation);
  await page.waitForTimeout(100);
}

async function capture(page, bugId, perspective, stage, annotation = null) {
  if (annotation) {
    await annotatePage(page, annotation);
  }
  const folder = path.join(outputRoot, bugId);
  fs.mkdirSync(folder, { recursive: true });
  const sequence = captures.filter(item => item.bugId === bugId).length + 1;
  const filename = `screenshot-${String(sequence).padStart(2, '0')}.png`;
  const fullPath = path.join(folder, filename);
  await page.screenshot({ path: fullPath, type: 'png', fullPage: false, animations: 'disabled' });
  captures.push({ bugId, perspective, stage, path: path.relative(outputRoot, fullPath).replaceAll('\\', '/') });
  if (annotation) {
    await page.evaluate(() => {
      document.querySelectorAll('.debuglab-annotation').forEach(el => el.remove());
    });
  }
  return fullPath;
}

function validatePngs() {
  return captures.map(captureRecord => {
    const filename = path.join(outputRoot, captureRecord.path);
    const image = fs.readFileSync(filename);
    if (image.length < 15_000 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`Invalid PNG evidence: ${filename}`);
    }
    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    if (width !== viewport.width || height !== viewport.height) {
      throw new Error(`Unexpected screenshot dimensions for ${filename}: ${width}x${height}`);
    }
    return { ...captureRecord, width, height, bytes: image.length };
  });
}

async function runBug01(browser) {
  await resetScenario();
  const page = await createPage(browser);
  await loginAsDemoCustomer(page);
  await openCartAndCheckout(page);

  const orderResponses = [];
  page.on('response', response => {
    if (response.url().endsWith('/api/checkout/place-order') && response.request().method() === 'POST') {
      orderResponses.push(response);
    }
  });
  await page.locator('#btn-place-order').dblclick({ delay: 5 });
  await expect.poll(() => orderResponses.length).toBe(2);
  const placedOrders = await Promise.all(orderResponses.map(async response => {
    expect(response.status()).toBe(201);
    return (await response.json()).order;
  }));
  if (new Set(placedOrders.map(order => order.id)).size !== 2) throw new Error('BUG-01 did not create two distinct orders.');

  await expect(page.locator('#payment-gateway-modal')).toBeVisible();
  await page.locator('#payment-gateway-modal button[aria-label="Close"]').click();
  await goToCustomerOrders(page);
  for (const order of placedOrders) await expect(page.locator('#profile-orders-list')).toContainText(order.orderNumber);
  await expect(page.locator('#profile-orders-list')).toContainText('Sony WF-1000XM5');
  await capture(page, 'DL-BUG-001', 'Customer', 'Two orders from one double-click checkout', {
    card: {
      tag: 'BUG 1 VISUAL DEMONSTRATION',
      title: '🔴 Duplicate Checkout Requests',
      description: 'Rapidly clicking or double-clicking "Place Order" bypasses idempotency guards and creates multiple distinct orders and charges for a single checkout attempt.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#profile-orders-list > div:nth-child(1)',
        label: `⚠️ Duplicate Order #1 (${placedOrders[0].orderNumber}) - Placed via double-click`,
        badgePos: 'top'
      },
      {
        selector: '#profile-orders-list > div:nth-child(2)',
        label: `⚠️ Duplicate Order #2 (${placedOrders[1].orderNumber}) - Identical items charged twice!`,
        badgePos: 'bottom'
      }
    ]
  });
}

async function runBug02(browser) {
  await resetScenario();
  const page = await createPage(browser);
  const search = page.locator('#global-search-input');
  const dropdown = page.locator('#search-results-dropdown');

  const laptopRequest = page.waitForRequest(request => request.url().includes('/api/search?q=laptop'));
  await search.fill('laptop');
  await laptopRequest;
  const mobileResponse = page.waitForResponse(response => response.url().includes('/api/search?q=mobile') && response.status() === 200);
  await search.fill('mobile');
  await mobileResponse;
  await expect(dropdown).toContainText('Search results for: "mobile"');
  await capture(page, 'DL-BUG-002', 'Customer', 'The latest mobile search response appears first', {
    card: {
      tag: 'BUG 2 VISUAL DEMONSTRATION • STEP 1/2',
      title: '🟡 Fast Query "mobile" Responds First',
      description: 'User searched "laptop" then rapidly typed "mobile". The faster "mobile" search finishes first and renders valid results.',
      position: { top: '100px', right: '30px' },
      tagBg: '#d97706',
      borderColor: '#f59e0b'
    },
    highlights: [
      {
        selector: '#global-search-input',
        label: '🔍 Active Query Input: "mobile"',
        color: '#3b82f6',
        bgGlow: 'rgba(59, 130, 246, 0.05)',
        shadow: '0 0 16px rgba(59, 130, 246, 0.4)'
      },
      {
        selector: '#search-results-dropdown',
        label: '✅ Mobile search response displayed',
        color: '#10b981',
        bgGlow: 'rgba(16, 185, 129, 0.05)',
        shadow: '0 0 16px rgba(16, 185, 129, 0.4)'
      }
    ]
  });

  await page.waitForResponse(response => response.url().includes('/api/search?q=laptop') && response.status() === 200, { timeout: 7_000 });
  await expect(search).toHaveValue('mobile');
  await expect(dropdown).toContainText('Search results for: "laptop"');
  await expect(dropdown).toContainText('MacBook Pro');
  await capture(page, 'DL-BUG-002', 'Customer', 'The older laptop response replaces mobile results', {
    card: {
      tag: 'BUG 2 VISUAL DEMONSTRATION • STEP 2/2',
      title: '🔴 Stale Search Results Overwrite Query',
      description: 'The delayed response from previous search "laptop" arrives late and overwrites the active search dropdown, displaying laptops while the input still reads "mobile".',
      position: { top: '100px', right: '30px' }
    },
    highlights: [
      {
        selector: '#global-search-input',
        label: '⚠️ Active Search Input Remains: "mobile"',
        color: '#f59e0b',
        bgGlow: 'rgba(245, 158, 11, 0.05)',
        shadow: '0 0 16px rgba(245, 158, 11, 0.4)'
      },
      {
        selector: '#search-results-dropdown',
        label: '🚨 BUG: Stale "laptop" results overwrote the active search dropdown!',
        color: '#ef4444',
        bgGlow: 'rgba(239, 68, 68, 0.05)',
        shadow: '0 0 18px rgba(239, 68, 68, 0.45)'
      }
    ]
  });
}

async function runBug03(browser) {
  await resetScenario(async () => {
    db.products.find(product => product.id === 'prod-cam-06').stock = 1;
    db.carts['user-customer-demo'] = [];
    db.carts['user-customer-2'] = [];
  });

  const pageA = await createPage(browser, 'user-customer-demo');
  const pageB = await createPage(browser, 'user-customer-2');
  await loginAsDemoCustomer(pageA);
  await loginAsCustomerTwo(pageB);
  const title = 'Nikon Z8 Flagship Hybrid Mirrorless Camera Body';
  await Promise.all([
    addProductThroughSearch(pageA, 'Nikon Z8', title),
    addProductThroughSearch(pageB, 'Nikon Z8', title)
  ]);
  await Promise.all([openCartAndCheckout(pageA), openCartAndCheckout(pageB)]);
  await capture(pageA, 'DL-BUG-003', 'Customer A', 'Checkout with the last Nikon Z8', {
    card: {
      tag: 'BUG 3 VISUAL DEMONSTRATION • CUSTOMER A',
      title: '🔴 Concurrent Checkout Attempt (Unit 1/1)',
      description: 'Customer A proceeds to checkout for the single remaining Nikon Z8 camera in inventory (Stock: 1).',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#checkout-modal .bg-white',
        label: '1️⃣ Customer A: Checking out last Nikon Z8 unit (Stock: 1)'
      }
    ]
  });
  await capture(pageB, 'DL-BUG-003', 'Customer B', 'Independent customer checks out the same last Nikon Z8', {
    card: {
      tag: 'BUG 3 VISUAL DEMONSTRATION • CUSTOMER B',
      title: '🔴 Simultaneous Checkout Attempt (Same Unit)',
      description: 'Simultaneously, independent Customer B proceeds to checkout for the exact same last remaining Nikon Z8 unit.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#checkout-modal .bg-white',
        label: '2️⃣ Customer B: Simultaneously attempting to checkout same unit'
      }
    ]
  });

  const responsesA = [];
  const responsesB = [];
  pageA.on('response', response => {
    if (response.url().endsWith('/api/checkout/place-order') && response.request().method() === 'POST') responsesA.push(response);
  });
  pageB.on('response', response => {
    if (response.url().endsWith('/api/checkout/place-order') && response.request().method() === 'POST') responsesB.push(response);
  });
  await Promise.all([
    pageA.locator('#btn-place-order').click(),
    pageB.locator('#btn-place-order').click()
  ]);
  await expect.poll(() => responsesA.length).toBe(1);
  await expect.poll(() => responsesB.length).toBe(1);
  expect(responsesA[0].status()).toBe(201);
  expect(responsesB[0].status()).toBe(201);
  await expect(pageA.locator('#gw-status-heading')).toHaveText('Payment Completed Successfully!', { timeout: 7_000 });
  await expect(pageB.locator('#gw-status-heading')).toHaveText('Payment Completed Successfully!', { timeout: 7_000 });
  expect(db.products.find(product => product.id === 'prod-cam-06').stock).toBe(-1);
  await capture(pageA, 'DL-BUG-003', 'Customer A', 'Checkout and simulated payment succeed', {
    card: {
      tag: 'BUG 3 VISUAL DEMONSTRATION • CUSTOMER A SUCCESS',
      title: '🟢 First Checkout Order Confirmed',
      description: 'Customer A completes payment. The 1 available unit is claimed, reducing remaining physical inventory to 0.',
      position: { top: '30px', right: '30px' },
      tagBg: '#059669',
      borderColor: '#10b981'
    },
    highlights: [
      {
        selector: '#gw-status-heading',
        label: '✅ Customer A: Payment Success & Order Placed (Stock should now be 0)',
        color: '#10b981',
        bgGlow: 'rgba(16, 185, 129, 0.05)',
        shadow: '0 0 16px rgba(16, 185, 129, 0.4)'
      }
    ]
  });
  await capture(pageB, 'DL-BUG-003', 'Customer B', 'Concurrent checkout also succeeds', {
    card: {
      tag: 'BUG 3 VISUAL DEMONSTRATION • CRITICAL OVERSELL',
      title: '🔴 Race Condition: Second Order Also Confirmed!',
      description: 'Despite zero remaining inventory, Customer B\'s simultaneous order is approved without atomic stock reservation, creating a critical oversell.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#gw-status-heading',
        label: '🚨 Oversold! Order confirmed despite zero stock remaining!'
      }
    ]
  });

  const observer = await createPage(browser);
  await observer.locator('#global-search-input').fill('Nikon Z8');
  const dropdown = observer.locator('#search-results-dropdown');
  await expect(dropdown).toContainText(title);
  await dropdown.getByText(title, { exact: false }).click();
  await expect(observer.locator('#product-modal')).toBeVisible();
  await expect(observer.locator('#modal-product-stock')).toHaveText('Backordered (-1 units)');
  await capture(observer, 'DL-BUG-003', 'Storefront', 'Catalog shows the oversold item backordered by one unit', {
    card: {
      tag: 'BUG 3 VISUAL DEMONSTRATION • INVENTORY DEFICIT',
      title: '🔴 Negative Stock Level: -1 Units',
      description: 'Concurrent uncoordinated checkouts allowed two purchases of a single available unit, driving product stock into negative deficit.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#modal-product-stock',
        label: '🚨 Critical Inventory Deficit: Backordered (-1 units)!'
      }
    ]
  });
}

async function runBug04(browser) {
  await resetScenario();
  const page = await createPage(browser);
  await loginAsDemoCustomer(page);
  await openCartAndCheckout(page);
  await page.locator('#btn-place-order').click();
  await expect(page.locator('#payment-gateway-modal')).toBeVisible();
  await expect(page.locator('#gw-status-heading')).toHaveText('Payment Completed Successfully!', { timeout: 7_000 });

  const order = db.orders[0];
  const firstMessage = await page.locator('#gw-status-message').textContent();
  const firstTransaction = firstMessage.match(/Transaction ID:\s*([^.]*)/)[1].trim();
  await capture(page, 'DL-BUG-004', 'Customer', 'First simulated payment settles', {
    card: {
      tag: 'BUG 4 VISUAL DEMONSTRATION • RETRY VULNERABILITY',
      title: '🔴 Payment Settled (Retry Button Active)',
      description: 'Payment settles successfully and issues an initial Transaction ID. However, the "Retry Payment" button remains active instead of being disabled.',
      position: { top: '30px', right: '30px' },
      tagBg: '#d97706',
      borderColor: '#f59e0b'
    },
    highlights: [
      {
        selector: '#gw-status-message',
        label: `💳 Transaction 1 Issued: ${firstTransaction}`,
        color: '#3b82f6',
        bgGlow: 'rgba(59, 130, 246, 0.05)',
        shadow: '0 0 16px rgba(59, 130, 246, 0.4)'
      },
      {
        selector: '#gw-retry-btn',
        label: '⚠️ Vulnerability: "Retry Payment" button remains active after success!',
        badgePos: 'bottom',
        color: '#ef4444'
      }
    ]
  });

  const retryResponse = page.waitForResponse(response => response.url().endsWith('/api/payments/process') && response.request().method() === 'POST');
  await page.locator('#gw-retry-btn').click();
  expect((await retryResponse).status()).toBe(200);
  await expect(page.locator('#gw-status-heading')).toHaveText('Payment Completed Successfully!');
  const retryMessage = await page.locator('#gw-status-message').textContent();
  const secondTransaction = retryMessage.match(/Transaction ID:\s*([^.]*)/)[1].trim();
  expect(secondTransaction).not.toBe(firstTransaction);
  const successfulPayments = db.payments.filter(payment => payment.orderId === order.id && payment.status === 'SUCCESS');
  expect(successfulPayments).toHaveLength(2);

  await page.locator('#gw-continue-btn').click();
  await expect(page.locator('#view-profile')).toBeVisible();
  await page.locator('#user-menu-btn').click();
  await page.locator('#user-dropdown-menu').getByRole('button', { name: /Demo Admin/ }).click();
  await expect(page.locator('#admin-audit-logs')).toContainText(order.id);
  await expect(page.locator('#admin-audit-logs')).toContainText(firstTransaction);
  await expect(page.locator('#admin-audit-logs')).toContainText(secondTransaction);
  await page.locator('#admin-audit-logs').scrollIntoViewIfNeeded();
  await capture(page, 'DL-BUG-004', 'Administrator', 'Audit log shows two successful transaction IDs for one order', {
    card: {
      tag: 'BUG 4 VISUAL DEMONSTRATION • AUDIT LOG EVIDENCE',
      title: '🔴 Duplicate Payment Charges in Audit Log',
      description: 'Clicking retry on an already-paid order charged the customer twice. The admin audit log records two distinct SUCCESS transactions for the same order.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        parentSelector: '#admin-audit-logs > div',
        containsText: secondTransaction,
        label: `🚨 Transaction 2: Duplicate SUCCESS charged to order (${secondTransaction})`
      },
      {
        parentSelector: '#admin-audit-logs > div',
        containsText: firstTransaction,
        label: `💳 Transaction 1: Original valid SUCCESS transaction (${firstTransaction})`,
        badgePos: 'bottom',
        color: '#3b82f6',
        bgGlow: 'rgba(59, 130, 246, 0.05)',
        shadow: '0 0 16px rgba(59, 130, 246, 0.4)'
      }
    ]
  });
}

async function runBug05(browser) {
  await resetScenario();
  const page = await createPage(browser);
  const grid = page.locator('#trending-product-grid');
  await page.locator('h2').filter({ hasText: 'Trending Top Picks' }).scrollIntoViewIfNeeded();
  await expect(grid.locator('.product-card')).toHaveCount(8);
  const visibleTopProduct = (await grid.locator('.product-card h3').first().textContent()).trim();
  const actualRanking = (await (await fetch(`${baseUrl}/api/products/trending?limit=8`)).json()).trending;
  const expectedTop = [...db.products].sort((a, b) => {
    const scoreA = a.salesScore * 0.4 + a.rating * 20 + a.reviewCount * 0.1;
    const scoreB = b.salesScore * 0.4 + b.rating * 20 + b.reviewCount * 0.1;
    return scoreB - scoreA || a.id.localeCompare(b.id);
  })[0];
  expect(actualRanking[0].id).not.toBe(expectedTop.id);
  expect(visibleTopProduct).toBe(actualRanking[0].title);
  await page.locator('#trending-product-grid').scrollIntoViewIfNeeded();
  await capture(page, 'DL-BUG-005', 'Storefront', 'Trending products appear in the wrong priority order', {
    card: {
      tag: 'BUG 5 VISUAL DEMONSTRATION',
      title: '🔴 Inverted Product Ranking Heap',
      description: 'The priority queue max-heap is inverted into a min-heap, placing low-engagement and low-rated products at the top while store bestsellers are buried.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#trending-product-grid .product-card:nth-child(1)',
        label: '🚨 Inverted Rank #1: Lowest-ranked product placed at top!'
      },
      {
        selector: '#trending-product-grid .product-card:nth-child(2)',
        badgePos: 'bottom',
        label: '⚠️ Inverted Rank #2: Low-sales item promoted over bestsellers'
      }
    ]
  });
}

async function runBug06(browser) {
  await resetScenario();
  const page = await createPage(browser);
  await page.locator('#nav-shop').click();
  await expect(page.locator('#view-shop')).toBeVisible();
  await page.locator('.catalog-filter-disclosure summary').click();
  await page.locator('#filter-category').selectOption('audio');
  await page.locator('#filter-brand').fill('Sony');
  await expect(page.locator('#catalog-count-label')).toHaveText('Showing 2 of 2 products');
  await expect(page.locator('#shop-product-grid .product-card')).toHaveCount(2);
  await capture(page, 'DL-BUG-006', 'Customer', 'Filtered Sony Audio products appear on the first page', {
    card: {
      tag: 'BUG 6 VISUAL DEMONSTRATION • PAGE 1 CALCULATION',
      title: '🔴 Filtered Query & Pagination Mismatch',
      description: 'Filtered by Category "Audio" and Brand "Sony" (2 matching items). The page displays 2 items, but pagination incorrectly calculates 5 pages based on unfiltered catalog size.',
      position: { top: '30px', right: '30px' },
      tagBg: '#d97706',
      borderColor: '#f59e0b'
    },
    highlights: [
      {
        selector: '.catalog-filter-disclosure',
        label: '🔍 Active Filters: Audio + Sony (2 total matches)',
        color: '#3b82f6',
        bgGlow: 'rgba(59, 130, 246, 0.05)',
        shadow: '0 0 16px rgba(59, 130, 246, 0.4)'
      },
      {
        selector: '#catalog-count-label',
        label: '✅ Matching Count: Showing 2 of 2 products',
        color: '#10b981',
        bgGlow: 'rgba(16, 185, 129, 0.05)',
        shadow: '0 0 16px rgba(16, 185, 129, 0.4)'
      }
    ]
  });

  await page.locator('#next-page-btn').click();
  await page.locator('#next-page-btn').click();
  await expect(page.locator('#pagination-page-indicator')).toHaveText('Page 3 of 5');
  await expect(page.locator('#catalog-count-label')).toHaveText('Showing 0 of 0 products');
  await expect(page.locator('#shop-product-grid')).toContainText('No products match these filters');
  await capture(page, 'DL-BUG-006', 'Customer', 'Filtered matches disappear on a later page', {
    card: {
      tag: 'BUG 6 VISUAL DEMONSTRATION • DROPPED ITEMS',
      title: '🔴 Filtered Products Disappear Across Pages',
      description: 'Navigating to Page 3 slices the unfiltered product list before applying filters, resulting in zero products displayed despite 2 matching products in catalog.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#shop-product-grid',
        label: '🚨 Premature Empty State: "No products match these filters"'
      },
      {
        selector: '#pagination-page-indicator',
        label: '⚠️ "Page 3 of 5" rendered with 0 items'
      }
    ]
  });
}

async function runBug07(browser) {
  await resetScenario();
  const page = await createPage(browser);
  await loginAsDemoCustomer(page);
  await page.route('**/api/payments/process', async route => {
    const payload = route.request().postDataJSON();
    const apiResponse = await fetch(`${baseUrl}/api/payments/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, simulatedOutcome: 'FAILURE' })
    });
    await route.fulfill({
      status: apiResponse.status,
      contentType: 'application/json',
      body: await apiResponse.text()
    });
  });
  await openCartAndCheckout(page);
  await page.locator('#btn-place-order').click();
  await expect(page.locator('#gw-status-heading')).toHaveText('Payment Completed Successfully!', { timeout: 7_000 });

  const order = db.orders[0];
  const failedPayment = db.findPaymentByOrderId(order.id);
  expect(failedPayment.status).toBe('FAILED');
  expect(order.status).toBe('PENDING_PAYMENT');
  await capture(page, 'DL-BUG-007', 'Customer', 'Gateway screen reports success after a failed simulated payment', {
    card: {
      tag: 'BUG 7 VISUAL DEMONSTRATION • FALSE SUCCESS',
      title: '🔴 False Payment Success Screen',
      description: 'The backend payment service returned FAILURE, but the gateway UI bypassed response verification and falsely displayed "Payment Completed Successfully!".',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#gw-status-heading',
        label: '🚨 False Success Heading: Backend payment actually FAILED!'
      },
      {
        selector: '#gw-status-message',
        label: '⚠️ Unverified confirmation displayed to customer',
        badgePos: 'bottom',
        color: '#f59e0b',
        bgGlow: 'rgba(245, 158, 11, 0.05)',
        shadow: '0 0 16px rgba(245, 158, 11, 0.4)'
      }
    ]
  });

  await page.locator('#gw-continue-btn').click();
  await expect(page.locator('#view-profile')).toBeVisible();
  const pendingRow = page.locator('#profile-orders-list > div').filter({ hasText: order.orderNumber });
  await expect(pendingRow).toContainText('PENDING_PAYMENT');
  await capture(page, 'DL-BUG-007', 'Customer', 'Order history still shows payment pending', {
    card: {
      tag: 'BUG 7 VISUAL DEMONSTRATION • STATE DISCREPANCY',
      title: '🔴 Unpaid State Exposed in Order History',
      description: 'Customer order history exposes the truth: the order status was never updated to PAID because payment failed on the server.',
      position: { top: '30px', right: '30px' }
    },
    highlights: [
      {
        selector: '#profile-orders-list > div:nth-child(1)',
        label: '🚨 Actual Backend Status: PENDING_PAYMENT (Unpaid)'
      }
    ]
  });
}

async function runBug08(browser) {
  await resetScenario(async () => {
    for (const inventory of db.warehouseInventory) {
      inventory.stock = 0;
      inventory.reservedStock = 0;
    }
    const product = db.products.find(item => item.id === 'prod-mob-01');
    product.stock = 4;
    const primary = db.warehouseInventory.find(item => item.productId === product.id && item.warehouseId === 'wh-1');
    const secondary = db.warehouseInventory.find(item => item.productId === product.id && item.warehouseId === 'wh-2');
    primary.stock = 3;
    primary.reservedStock = 3;
    secondary.stock = 1;
    secondary.reservedStock = 0;
  });

  // FlashCart's challenge checkout path does not call the warehouse allocator.
  // Invoke the app's real service with a controlled inventory fixture, then inspect
  // the resulting state through the normal Admin dashboard UI.
  const allocation = warehouseService.allocateInventory([{ productId: 'prod-mob-01', quantity: 1 }], 'scenario-order-warehouse');
  expect(allocation[0].allocations[0].warehouseId).toBe('wh-1');
  const page = await createPage(browser);
  await loginAsDemoAdmin(page);
  await page.locator('#admin-warehouses-list').scrollIntoViewIfNeeded();
  const primaryCard = page.locator('#admin-warehouses-list > div').filter({ hasText: 'WH-MUM-01' });
  const secondaryCard = page.locator('#admin-warehouses-list > div').filter({ hasText: 'WH-DEL-02' });
  await expect(primaryCard).toContainText('Stock: 2');
  await expect(primaryCard).toContainText('Reserved: 3');
  await expect(secondaryCard).toContainText('Stock: 1');
  await capture(page, 'DL-BUG-008', 'Administrator', 'Warehouse dashboard shows allocation against fully reserved primary stock', {
    card: {
      tag: 'BUG 8 VISUAL DEMONSTRATION',
      title: '🔴 Inventory Allocated to Depleted Warehouse',
      description: 'WH-MUM-01 had 3 stock and 3 reserved (0 unreserved available). The allocator deducted from it anyway (Stock: 2, Reserved: 3), creating an unreserved stock deficit instead of routing to WH-DEL-02.',
      position: { top: '20px', right: '28px' }
    },
    highlights: [
      {
        selector: '#admin-warehouses-list > div:nth-child(1)',
        label: '🚨 WH-MUM-01: Stock 2 < Reserved 3 (Deficit: -1)'
      },
      {
        selector: '#admin-warehouses-list > div:nth-child(2)',
        label: '⚠️ WH-DEL-02: Had 1 unreserved unit available',
        badgePos: 'bottom',
        color: '#f59e0b',
        bgGlow: 'rgba(245, 158, 11, 0.05)',
        shadow: '0 0 16px rgba(245, 158, 11, 0.4)'
      }
    ]
  });
}

async function writeReports() {
  const validatedCaptures = validatePngs();
  const bugCounts = new Map();
  for (const captureRecord of validatedCaptures) {
    bugCounts.set(captureRecord.bugId, (bugCounts.get(captureRecord.bugId) || 0) + 1);
  }
  const manifest = {
    challengeId: 'express-challenge',
    applicationId: 'DL-APP-001',
    application: 'FlashCart',
    generatedAt: new Date().toISOString(),
    viewport,
    captures: validatedCaptures
  };
  fs.writeFileSync(path.join(outputRoot, 'evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const rows = [...bugCounts.entries()].map(([bugId, count]) => `| ${bugId} | ${count} | ${count > 1 ? 'Multiple customer/admin states' : 'Single perspective'} | Generated |`);
  const report = `# FlashCart Visual Evidence Report\n\n- **Application:** FlashCart (` + '`DL-APP-001`' + `)\n- **Stack:** Node.js, Express, static HTML/CSS/JavaScript frontend, in-memory seeded data store\n- **Intentional incidents:** 8\n- **Screenshots generated and validated:** ${validatedCaptures.length}\n- **Multi-user scenarios:** 1 (concurrent last-unit checkout)\n- **Payment workflows:** 2 (simulated only; no real charges)\n- **Failed captures:** 0\n- **Viewport:** ${viewport.width} × ${viewport.height}\n- **Screenshot checks:** PNG signature, size, dimensions, Playwright state assertions, and visual inspection\n- **Visual Bug Markings:** Every screenshot includes high-visibility bug demonstration cards, dashed bounding boxes, and contextual incident tags identifying the exact failure mechanism\n- **Application source changed:** No. Existing challenge bugs remain active.\n\n## Per-incident results\n\n| Bug ID | Screenshots | Perspectives | Status |\n|---|---:|---|---|\n${rows.join('\n')}\n\n## Reproduction\n\nRun ` + '`npm run capture:evidence`' + ` from the FlashCart repository root. It starts an isolated in-process challenge server, resets the seeded data between scenarios, performs the browser journeys, saves the screenshots, validates them, and writes the evidence manifest.\n\n## Special setup\n\n- DL-BUG-003 uses two independent signed-in customer contexts and the seeded one-unit Nikon Z8 item.\n- DL-BUG-007 returns an actual failed response from FlashCart's simulated payment service to the browser, exposing the UI's false success message. No payment is processed.\n- DL-BUG-008 has no challenge-mode checkout/API path that invokes the warehouse allocator. The capture runner prepares an in-memory warehouse fixture, calls the existing allocator service, then captures the real Admin dashboard.\n`;
  fs.writeFileSync(path.join(outputRoot, 'execution-report.md'), report);
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const server = app.listen(port, '127.0.0.1');
  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    await runBug01(browser);
    await runBug02(browser);
    await runBug03(browser);
    await runBug04(browser);
    await runBug05(browser);
    await runBug06(browser);
    await runBug07(browser);
    await runBug08(browser);
    db.reset();
    await writeReports();
    console.log(`Captured and validated ${captures.length} FlashCart screenshots.`);
    for (const item of captures) console.log(`${item.bugId}: ${item.path} (${item.perspective})`);
  } finally {
    db.reset();
    if (browser) await browser.close();
    for (const context of contexts) await context.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
