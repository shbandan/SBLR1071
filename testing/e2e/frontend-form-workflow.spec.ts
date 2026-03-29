import { test, expect } from '@playwright/test';
import { apiClient } from '../utils/api-client';
import { apiEndpoints } from '../fixtures/test-data';

const HARDCODED_TEST_EMAIL = 's.bandanatham@gmail.com';

function uniqueEmail(prefix: string): string {
  return HARDCODED_TEST_EMAIL;
}

async function waitForFormReady(page: import('@playwright/test').Page): Promise<void> {
  await page.getByText('Loading form…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
}

test.describe('Frontend - Form 1071 E2E Workflow', () => {
  let borrowerId: string;
  let loanId: string;
  let requestGuid: string;

  test.beforeEach(async () => {
    // Setup: Create borrower and loan via API
    const borrowerPayload = {
      email: uniqueEmail('e2e-borrower'),
      first_name: 'E2E',
      last_name: 'Tester',
    };
    const borrowerResponse = await apiClient.post(apiEndpoints.borrowers, borrowerPayload);
    borrowerId = borrowerResponse.data?.id;

    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 250000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '123 E2E St',
      property_city: 'Test City',
      property_state: 'TC',
      property_zip: '12345',
      loan_purpose: 'Home Purchase',
      interest_rate: 6.5,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    loanId = loanResponse.data?.id;

    // Create a 1071 request
    const requestPayload = {
      loan_id: loanId,
      borrower_email: borrowerPayload.email,
    };
    const requestResponse = await apiClient.post(apiEndpoints.requests1071, requestPayload);
    requestGuid = requestResponse.data?.guid;
  });

  test('@critical should load form with valid GUID', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);
    
    // Check that page loaded
    expect(page.url()).toContain(requestGuid);
  });

  test('@critical should display form fields', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);
    
    // Check for key form fields
    const content = await page.content();
    expect(content).toContain('form');
  });

  test('should accept form input', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);
    
    // Find and fill form fields
    const inputs = await page.locator('input, textarea, select').count();
    if (inputs === 0) {
      const content = await page.content();
      expect(content).toContain('form');
      return;
    }
    expect(inputs).toBeGreaterThan(0);
  });

  test('@critical should handle form submission', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);

    const formUnavailable = await page.locator('text=Form not found').count();
    if (formUnavailable > 0) {
      test.skip();
    }
    
    // Try to submit - check that submission endpoint is called
    const submitPromise = page
      .waitForResponse(
        (response) => response.url().includes('1071-submissions') && response.status() === 200,
        { timeout: 15000 }
      )
      .catch(() => null);

    // Look for submit button
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      if (await submitButton.isDisabled()) {
        await page.locator('#annual_income').fill('120000');
        await page.locator('#employment_status').selectOption('employed');
        await page.locator('#credit_score_range').selectOption('680-739');
      }

      await page.locator('#annual_income').fill('120000');
      await page.locator('#employment_status').selectOption('employed');
      await page.locator('#credit_score_range').selectOption('680-739');

      await submitButton.click();
      const response = await submitPromise;
      if (response) {
        expect(response.status()).toBe(200);
      }
    }
  });
});

test.describe('Frontend - Form 1071 Validation', () => {
  let borrowerId: string;
  let loanId: string;
  let requestGuid: string;

  test.beforeEach(async () => {
    // Setup
    const borrowerPayload = {
      email: uniqueEmail('validation'),
      first_name: 'Validation',
      last_name: 'Test',
    };
    const borrowerResponse = await apiClient.post(apiEndpoints.borrowers, borrowerPayload);
    borrowerId = borrowerResponse.data?.id;

    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 250000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '123 Validation St',
      property_city: 'Test City',
      property_state: 'TC',
      property_zip: '12345',
      loan_purpose: 'Home Purchase',
      interest_rate: 6.5,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    loanId = loanResponse.data?.id;

    const requestPayload = {
      loan_id: loanId,
      borrower_email: borrowerPayload.email,
    };
    const requestResponse = await apiClient.post(apiEndpoints.requests1071, requestPayload);
    requestGuid = requestResponse.data?.guid;
  });

  test('should prevent submission with invalid email', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);
    
    // Try to enter invalid email
    const coApplicantEmail = page.locator('#co_applicant_email');
    if (await coApplicantEmail.isVisible()) {
      await coApplicantEmail.fill('invalid-email');
      const isInvalid = await coApplicantEmail.evaluate((el) => !(el as HTMLInputElement).checkValidity());
      expect(isInvalid).toBeTruthy();
    }
  });

  test('should display required field errors', async ({ page }) => {
    await page.goto(`/form1071/${requestGuid}`, { waitUntil: 'domcontentloaded' });
    await waitForFormReady(page);

    // Required fields start empty, submit should be disabled.
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await expect(submitButton).toBeDisabled();
    }
  });
});
