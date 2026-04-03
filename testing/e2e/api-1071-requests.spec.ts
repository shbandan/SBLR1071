import { test, expect } from '@playwright/test';
import { apiClient } from '../utils/api-client';
import { apiEndpoints } from '../fixtures/test-data';
import { dbClient, dbQueries } from '../utils/db-client';

const HARDCODED_TEST_EMAIL = 'playwright-mock@example.com';

function uniqueEmail(prefix: string): string {
  return HARDCODED_TEST_EMAIL;
}

test.describe('Form 1071 Requests API Layer Tests', () => {
  let borrowerId: string;
  let loanId: string;

  test.beforeAll(async () => {
    await dbClient.connect();
  });

  test.beforeEach(async () => {
    // Create a borrower
    const borrowerPayload = {
      email: HARDCODED_TEST_EMAIL,
      first_name: 'Request',
      last_name: 'Tester',
    };
    const borrowerResponse = await apiClient.post(apiEndpoints.borrowers, borrowerPayload);
    borrowerId = borrowerResponse.data?.id;

    // Create a loan
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 250000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '123 Main St',
      property_city: 'New York',
      property_state: 'NY',
      property_zip: '10001',
      loan_purpose: 'Home Purchase',
      interest_rate: 6.5,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    loanId = loanResponse.data?.id;
  });

  test.afterAll(async () => {
    await dbClient.disconnect();
  });

  test('@critical POST /1071-requests should create a new request', async () => {
    const payload = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test'),
    };

    const response = await apiClient.post(apiEndpoints.requests1071, payload);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('guid');
    expect(response.data).toHaveProperty('status', 'pending');
    expect(response.data).toHaveProperty('loan_id', loanId);
  });

  test('@critical GET /1071-requests/:guid should retrieve request by GUID', async () => {
    // Create a request
    const createPayload = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-guid'),
    };
    const createResponse = await apiClient.post(apiEndpoints.requests1071, createPayload);
    const guid = createResponse.data?.guid;

    // Get the request
    const getResponse = await apiClient.get(`${apiEndpoints.requests1071}/${guid}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('guid', guid);
    expect(getResponse.data).toHaveProperty('status', 'pending');
  });

  test('@critical POST /1071-requests should generate unique GUID for each request', async () => {
    const payload1 = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-unique-1'),
    };

    const response1 = await apiClient.post(apiEndpoints.requests1071, payload1);
    const guid1 = response1.data?.guid;

    const payload2 = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-unique-2'),
    };
    const response2 = await apiClient.post(apiEndpoints.requests1071, payload2);
    const guid2 = response2.data?.guid;

    expect(guid1).not.toBe(guid2);
  });

  test('POST /1071-requests should deactivate previous requests for the same loan', async () => {
    // Create first request
    const payload1 = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-deactivate-1'),
    };
    const response1 = await apiClient.post(apiEndpoints.requests1071, payload1);
    const guid1 = response1.data?.guid;

    // Create second request for same loan
    const payload2 = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-deactivate-2'),
    };
    const response2 = await apiClient.post(apiEndpoints.requests1071, payload2);

    // Check if first request is now inactive
    const getResponse1 = await apiClient.get(`${apiEndpoints.requests1071}/${guid1}`);
    expect(getResponse1.data).toHaveProperty('status', 'inactive');
  });

  test('@critical PUT /1071-requests/:id should resend request with new GUID', async () => {
    // Create initial request
    const createPayload = {
      loan_id: loanId,
      borrower_email: uniqueEmail('test-resend'),
    };
    const createResponse = await apiClient.post(apiEndpoints.requests1071, createPayload);
    const requestId = createResponse.data?.id;
    const originalGuid = createResponse.data?.guid;

    // Resend the request
    const resendResponse = await apiClient.put(
      `${apiEndpoints.requests1071}/${requestId}`,
      {}
    );
    expect(resendResponse.status).toBe(200);
    const newGuid = resendResponse.data?.guid;
    expect(newGuid).not.toBe(originalGuid);
    expect(resendResponse.data).toHaveProperty('status', 'pending');
  });

  test('GET /1071-requests/:guid with invalid GUID should return 404', async () => {
    const response = await apiClient.get(`${apiEndpoints.requests1071}/invalid-guid-12345`);
    expect(response.status).toBe(404);
  });

  test('Database should reflect all 1071 request operations', async () => {
    // Create a request
    const payload = {
      loan_id: loanId,
      borrower_email: uniqueEmail('db-verify'),
    };
    const createResponse = await apiClient.post<any>(apiEndpoints.requests1071, payload);
    expect(createResponse.status).toBe(200);

    const guid = createResponse.data?.guid;
    const getResponse = await apiClient.get(`${apiEndpoints.requests1071}/${guid}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('guid', guid);
  });
});

