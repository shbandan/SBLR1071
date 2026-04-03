import { test, expect } from '@playwright/test';
import { apiClient } from '../../utils/api-client';
import { apiEndpoints } from '../../fixtures/test-data';

const HARDCODED_TEST_EMAIL = process.env.EMAIL_TEST_RECIPIENT || 'playwright-email-test@example.com';

function uniqueEmail(prefix: string): string {
  return HARDCODED_TEST_EMAIL;
}

test.describe('Email Delivery Suite', () => {
  test.skip(!process.env.ENABLE_REAL_EMAIL_TESTS, 'Set ENABLE_REAL_EMAIL_TESTS=1 to run real email tests');

  test('@email @api should send collection email via API create request', async () => {
    const borrowerPayload = {
      email: HARDCODED_TEST_EMAIL,
      first_name: 'EmailAPI',
      last_name: 'Tester',
    };
    const borrowerResponse = await apiClient.post(apiEndpoints.borrowers, borrowerPayload);
    expect(borrowerResponse.status).toBe(200);

    const loanPayload = {
      borrower_id: borrowerResponse.data?.id,
      loan_amount: 225000,
      loan_date: '2026-03-29T00:00:00',
      property_address: '101 Email Api Ave',
      property_city: 'Phoenix',
      property_state: 'AZ',
      property_zip: '85004',
      loan_purpose: 'Purchase',
      interest_rate: 6.1,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    expect(loanResponse.status).toBe(200);

    const requestPayload = {
      loan_id: loanResponse.data?.id,
      borrower_email: HARDCODED_TEST_EMAIL,
    };
    const requestResponse = await apiClient.post(apiEndpoints.requests1071, requestPayload);
    expect(requestResponse.status).toBe(200);
    expect(requestResponse.data).toHaveProperty('guid');
  });

  test('@email @ui should send collection email from dashboard action', async ({ page }) => {
    const borrowerPayload = {
      email: HARDCODED_TEST_EMAIL,
      first_name: 'EmailUI',
      last_name: 'Tester',
    };
    const borrowerResponse = await apiClient.post(apiEndpoints.borrowers, borrowerPayload);
    expect(borrowerResponse.status).toBe(200);

    const loanPayload = {
      borrower_id: borrowerResponse.data?.id,
      loan_amount: 199000,
      loan_date: '2026-03-29T00:00:00',
      property_address: '202 Email Ui Blvd',
      property_city: 'Phoenix',
      property_state: 'AZ',
      property_zip: '85005',
      loan_purpose: 'Purchase',
      interest_rate: 6.0,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    expect(loanResponse.status).toBe(200);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const search = page.getByTestId('dashboard-search-input');
    await search.fill('EmailUI');

    const borrowerRow = page.getByTestId(`borrower-row-${borrowerResponse.data?.id}`);
    await expect(borrowerRow).toBeVisible();

    await borrowerRow.getByTitle('Toggle loans').click();

    const sendButton = page.getByTitle('Send 1071 request').first();
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    await expect(page.getByText(/Email sent to/i)).toBeVisible();
  });
});
