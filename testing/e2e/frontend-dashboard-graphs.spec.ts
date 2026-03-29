import { test, expect } from '@playwright/test';

const summaryPayload = {
  borrowers: { completed: 4, total: 6 },
  loans: { completed: 10, total: 18 },
};

const responseTrendPayload = {
  points: [
    { quarter_label: 'Q2 24', average_response_days: 18, submitted_count: 2 },
    { quarter_label: 'Q3 24', average_response_days: 14, submitted_count: 3 },
    { quarter_label: 'Q4 24', average_response_days: 16, submitted_count: 2 },
    { quarter_label: 'Q1 25', average_response_days: 11, submitted_count: 4 },
    { quarter_label: 'Q2 25', average_response_days: 9, submitted_count: 5 },
    { quarter_label: 'Q3 25', average_response_days: 12, submitted_count: 3 },
    { quarter_label: 'Q4 25', average_response_days: 8, submitted_count: 6 },
    { quarter_label: 'Q1 26', average_response_days: 6, submitted_count: 7 },
  ],
};

test.describe('Frontend - Dashboard Graphs', () => {
  test('@critical should show loading states before rendering all 3 graphs', async ({ page }) => {
    await page.route('**/api/dashboard/borrowers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], has_more: false, next_cursor: null }),
      });
    });

    await page.route('**/api/dashboard/summary', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summaryPayload),
      });
    });

    await page.route('**/api/dashboard/response-trend', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseTrendPayload),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('dashboard-borrowers-meter-loading')).toBeVisible();
    await expect(page.getByTestId('dashboard-loans-meter-loading')).toBeVisible();
    await expect(page.getByTestId('dashboard-trend-loading')).toBeVisible();

    await expect(page.getByTestId('dashboard-borrowers-meter')).toBeVisible();
    await expect(page.getByTestId('dashboard-loans-meter')).toBeVisible();
    await expect(page.getByTestId('dashboard-trend-card')).toBeVisible();
  });

  test('@critical should render borrower, loan, and quarterly trend graphs from mixed mock data', async ({ page }) => {
    const graphRequests: string[] = [];

    await page.route('**/api/dashboard/borrowers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], has_more: false, next_cursor: null }),
      });
    });

    await page.route('**/api/dashboard/summary', async (route) => {
      graphRequests.push('summary');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summaryPayload),
      });
    });

    await page.route('**/api/dashboard/response-trend', async (route) => {
      graphRequests.push('trend');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseTrendPayload),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('dashboard-borrowers-meter-label')).toHaveText('Borrowers');
    await expect(page.getByTestId('dashboard-borrowers-meter-detail')).toHaveText('1071 submitted borrowers');
    await expect(page.getByTestId('dashboard-borrowers-meter-center')).toContainText('67%');
    await expect(page.getByTestId('dashboard-borrowers-meter-center')).toContainText('4/6');

    await expect(page.getByTestId('dashboard-loans-meter-label')).toHaveText('Loans');
    await expect(page.getByTestId('dashboard-loans-meter-detail')).toHaveText('1071 submitted loans');
    await expect(page.getByTestId('dashboard-loans-meter-center')).toContainText('56%');
    await expect(page.getByTestId('dashboard-loans-meter-center')).toContainText('10/18');

    await expect(page.getByTestId('dashboard-trend-title')).toHaveText('24-Month Response Trend');
    await expect(page.getByTestId('dashboard-trend-description')).toHaveText(
      'Avg days from request to 1071 submission by quarter'
    );
    await expect(page.getByTestId('dashboard-trend-latest')).toContainText('6d');
    await expect(page.getByTestId('dashboard-trend-latest')).toContainText('latest');
    await expect(page.getByTestId('dashboard-trend-chart')).toBeVisible();

    await expect(page.getByTestId('dashboard-trend-label-0')).toHaveText('Q2 24');
    await expect(page.getByTestId('dashboard-trend-label-7')).toHaveText('Q1 26');

    const trendPoints = page.locator('[data-testid^="dashboard-trend-point-"]');
    await expect(trendPoints).toHaveCount(responseTrendPayload.points.length);

    await expect(page.getByTestId('dashboard-trend-point-0')).toHaveAttribute('data-average-response-days', '18');
    await expect(page.getByTestId('dashboard-trend-point-4')).toHaveAttribute('data-submitted-count', '5');
    await expect(page.getByTestId('dashboard-trend-point-7')).toHaveAttribute('data-average-response-days', '6');

    expect(graphRequests).toEqual(expect.arrayContaining(['summary', 'trend']));
  });
});