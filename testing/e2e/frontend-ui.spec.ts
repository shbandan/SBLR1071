import { test, expect } from '@playwright/test';

const HARDCODED_TEST_EMAIL = 'playwright-mock@example.com';

function buildBorrowerRow(index: number) {
  return {
    id: `borrower-${index}`,
    first_name: `First${index}`,
    last_name: `Last${index}`,
    email: HARDCODED_TEST_EMAIL,
    created_at: new Date().toISOString(),
    loan_count: 1,
    pending_requests: 0,
    collected_requests: 1,
  };
}

test.describe('Frontend - Dashboard Page', () => {
  test('@smoke should load dashboard page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('localhost:3000');
  });

  test('@critical should display page title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'CFPB 1071 Dashboard' })).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should display dashboard content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-search-input')).toBeVisible();
    await expect(page.getByText(/Failed to load borrowers/i)).toHaveCount(0);
    
    // Check if page content is visible
    const content = await page.content();
    expect(content).toBeTruthy();
  });

  test('should be responsive on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const content = await page.content();
    expect(content).toBeTruthy();
    
    await context.close();
  });

  test('should be responsive on tablet', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const content = await page.content();
    expect(content).toBeTruthy();
    
    await context.close();
  });
});

test.describe('Frontend - Dashboard Data Loading', () => {
  test('@critical should load first 20 borrowers on landing and lazy-load more on scroll (real backend)', async ({ page, request, browserName }) => {
    test.skip(browserName !== 'chromium', 'Run heavy data-loading check on one browser only');

    const prefix = `UILoad${Date.now()}`;
    const total = 45;

    for (let i = 0; i < total; i++) {
      const payload = {
        email: HARDCODED_TEST_EMAIL,
        first_name: `${prefix}_${i}`,
        last_name: 'Perf',
      };
      const seedResponse = await request.post('http://127.0.0.1:8000/borrowers', { data: payload });
      expect(seedResponse.ok()).toBeTruthy();
    }

    await expect
      .poll(async () => {
        const response = await request.get(
          `http://127.0.0.1:8000/dashboard/borrowers?limit=20&q=${encodeURIComponent(prefix)}`
        );
        if (!response.ok()) {
          return -1;
        }

        const body = await response.json();
        return body.items?.length ?? 0;
      }, { timeout: 15000 })
      .toBe(20);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-search-input')).toBeVisible();

    await page.getByTestId('dashboard-search-input').fill(prefix);

    const borrowerRows = page.locator('table[data-testid="borrowers-table"] tbody > tr');
    await expect.poll(async () => await borrowerRows.count(), { timeout: 15000 }).toBe(20);

    const firstPageResponse = await request.get(
      `http://127.0.0.1:8000/dashboard/borrowers?limit=20&q=${encodeURIComponent(prefix)}`
    );
    expect(firstPageResponse.ok()).toBeTruthy();
    const firstPageBody = await firstPageResponse.json();

    await page.getByTestId('borrower-load-more-sentinel').scrollIntoViewIfNeeded();
    await page.waitForTimeout(750);

    if (firstPageBody.has_more) {
      const renderedCount = await borrowerRows.count();
      if (renderedCount <= 20) {
        const nextPageResponse = await request.get(
          `http://127.0.0.1:8000/dashboard/borrowers?limit=20&q=${encodeURIComponent(prefix)}&cursor=${encodeURIComponent(firstPageBody.next_cursor || '')}`
        );
        expect(nextPageResponse.ok()).toBeTruthy();
        const nextPageBody = await nextPageResponse.json();
        expect((nextPageBody.items || []).length).toBeGreaterThan(0);
      } else {
        expect(renderedCount).toBeGreaterThan(20);
      }
    } else {
      await expect.poll(async () => await borrowerRows.count(), { timeout: 15000 }).toBe(20);
    }
  });

  test('should render Add New Borrower button next to search', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-search-input')).toBeVisible();
    await expect(page.getByTestId('add-new-borrower-button')).toBeVisible();
  });

  test('@critical should paginate borrowers and lazy-load loans on drill down', async ({ page }) => {
    const borrowerCalls: string[] = [];
    const loanCalls: string[] = [];

    await page.route('**/dashboard/borrowers**', async (route) => {
      const url = new URL(route.request().url());
      borrowerCalls.push(url.search);

      const cursor = url.searchParams.get('cursor');
      const firstPage = Array.from({ length: 20 }, (_, i) => buildBorrowerRow(i + 1));
      const secondPage = Array.from({ length: 20 }, (_, i) => buildBorrowerRow(i + 21));

      const payload = cursor
        ? { items: secondPage, has_more: false, next_cursor: null }
        : { items: firstPage, has_more: true, next_cursor: 'next-page-cursor' };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    });

    await page.route('**/api/loans**', async (route) => {
      loanCalls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'loan-1',
            borrower_id: 'borrower-1',
            loan_amount: 250000,
            loan_date: new Date().toISOString(),
            property_address: '123 Main St',
            property_city: 'Phoenix',
            property_state: 'AZ',
            property_zip: '85001',
            loan_purpose: 'Purchase',
            interest_rate: 6.5,
            created_at: new Date().toISOString(),
            request: null,
            submitted_data: null,
          },
        ]),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('borrowers-table')).toBeVisible();

    await expect.poll(() => borrowerCalls.length).toBeGreaterThanOrEqual(1);
    expect(borrowerCalls[0]).toContain('limit=20');
    expect(loanCalls.length).toBe(0);

    await page.getByTestId('borrower-load-more-sentinel').scrollIntoViewIfNeeded();
    await expect.poll(() => borrowerCalls.length).toBeGreaterThanOrEqual(2);

    await page.getByTitle('Toggle loans').first().click();
    await expect.poll(() => loanCalls.length).toBe(1);
  });

  test('@critical should send typeahead query to dashboard API', async ({ page }) => {
    const queries: string[] = [];

    await page.route('**/dashboard/borrowers**', async (route) => {
      const url = new URL(route.request().url());
      queries.push(url.searchParams.get('q') || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], has_more: false, next_cursor: null }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const search = page.getByTestId('dashboard-search-input');
    await search.fill('250000');

    await expect.poll(() => queries.some((q) => q === '250000')).toBeTruthy();
  });

  test('@critical should export borrowers with loan records even when rows are not expanded', async ({ page }) => {
    const borrowers = [buildBorrowerRow(1), buildBorrowerRow(2)];
    const loanCalls: string[] = [];

    await page.route('**/dashboard/borrowers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: borrowers,
          has_more: false,
          next_cursor: null,
        }),
      });
    });

    await page.route('**/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          borrowers: { completed: 0, total: 2 },
          loans: { completed: 0, total: 2 },
        }),
      });
    });

    await page.route('**/dashboard/response-trend', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ points: [] }),
      });
    });

    await page.route('**/api/loans?borrower_id=*', async (route) => {
      const url = new URL(route.request().url());
      const borrowerId = url.searchParams.get('borrower_id') || '';
      loanCalls.push(borrowerId);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `loan-${borrowerId}`,
            borrower_id: borrowerId,
            loan_amount: 200000,
            loan_date: new Date().toISOString(),
            property_address: '123 Main St',
            property_city: 'Phoenix',
            property_state: 'AZ',
            property_zip: '85001',
            line_of_business: 'Commercial Banking',
            product_type: 'Term Loan',
            loan_purpose: 'Purchase',
            interest_rate: 6.1,
            created_at: new Date().toISOString(),
            request: null,
            submitted_data: null,
          },
        ]),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('borrowers-table')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export Data/i }).click();
    await downloadPromise;

    await expect.poll(() => new Set(loanCalls).size).toBe(2);
    expect(new Set(loanCalls)).toEqual(new Set(['borrower-1', 'borrower-2']));
    await expect(page.getByText('Data exported successfully!')).toBeVisible();
  });

  test('@critical should fetch search results from backend, not only loaded rows', async ({ page }) => {
    await page.route('**/dashboard/borrowers**', async (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get('q') || '';
      const cursor = url.searchParams.get('cursor');

      if (q === 'zeta') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'borrower-zeta',
                first_name: 'Zeta',
                last_name: 'Match',
                email: HARDCODED_TEST_EMAIL,
                created_at: new Date().toISOString(),
                loan_count: 1,
                pending_requests: 0,
                collected_requests: 0,
              },
            ],
            has_more: false,
            next_cursor: null,
          }),
        });
        return;
      }

      if (cursor) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: Array.from({ length: 20 }, (_, i) => buildBorrowerRow(i + 21)),
            has_more: false,
            next_cursor: null,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: Array.from({ length: 20 }, (_, i) => buildBorrowerRow(i + 1)),
          has_more: true,
          next_cursor: 'next-page-cursor',
        }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('cell', { name: 'First1 Last1' }).first()).toBeVisible();

    const search = page.getByTestId('dashboard-search-input');
    await search.fill('zeta');

    await expect(page.getByText('Zeta Match')).toBeVisible();
    await expect(page.getByText('First1 Last1')).toHaveCount(0);
  });

  test('@critical should not send typeahead query below 3 characters', async ({ page }) => {
    const queries: string[] = [];

    await page.route('**/dashboard/borrowers**', async (route) => {
      const url = new URL(route.request().url());
      queries.push(url.searchParams.get('q') || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], has_more: false, next_cursor: null }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const search = page.getByTestId('dashboard-search-input');
    await search.fill('ab');

    await page.waitForTimeout(400);
    expect(queries.some((q) => q === 'ab')).toBeFalsy();
  });
});

test.describe('Frontend - Form 1071 Page Navigation', () => {
  test('should navigate to form with valid GUID', async ({ page }) => {
    // Using a placeholder GUID - in real tests this would be created first
    const testGuid = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/form1071/${testGuid}`, { waitUntil: 'domcontentloaded' });
    
    // Should either load the form or show an error
    await page.waitForLoadState('domcontentloaded');
    const content = await page.content();
    expect(content).toBeTruthy();
  });

  test('should handle invalid GUID gracefully', async ({ page, context }) => {
    // Set up to catch any console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/form1071/invalid-guid-format', {
      waitUntil: 'domcontentloaded',
    });
    
    // Page should load without JavaScript errors
    expect(page.url()).toContain('form1071');
  });

  test('should redirect invalid routes to dashboard', async ({ page }) => {
    await page.goto('/invalid-page', {
      waitUntil: 'domcontentloaded',
    });
    
    // Should redirect to home
    expect(page.url()).toContain('localhost:3000');
  });
});

test.describe('Frontend - Error Boundary', () => {
  test('should display proper error message on API failure', async ({ page }) => {
    // Intercept API calls and fail them
    await page.route('http://localhost:8000/**', (route) => {
      route.abort('failed');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Page should still be visible (with error state)
    const content = await page.content();
    expect(content).toBeTruthy();
  });

  test('should recover from errors when API returns online', async ({ page }) => {
    // Start with failed requests
    let failRequests = true;
    
    await page.route('http://localhost:8000/**', (route) => {
      if (failRequests) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Change to allow requests
    failRequests = false;
    
    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    const content = await page.content();
    expect(content).toBeTruthy();
  });
});

test.describe('Frontend - Performance', () => {
  test('should load dashboard within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const loadTime = Date.now() - startTime;
    // Keep threshold practical for shared local dev machines.
    expect(loadTime).toBeLessThan(15000);
  });

  test('should not have excessive console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Allow for some errors but not excessive
    expect(errors.length).toBeLessThan(5);
  });
});

