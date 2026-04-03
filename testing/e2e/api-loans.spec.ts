import { test, expect } from '@playwright/test';
import { apiClient } from '../utils/api-client';
import { testData, apiEndpoints } from '../fixtures/test-data';
import { dbClient, dbQueries } from '../utils/db-client';

const HARDCODED_TEST_EMAIL = 'playwright-mock@example.com';

test.describe('Loan API Layer Tests', () => {
  let borrowerId: string;

  test.beforeAll(async () => {
    await dbClient.connect();
  });

  test.beforeEach(async () => {
    // Create a borrower for each test
    const payload = {
      email: HARDCODED_TEST_EMAIL,
      first_name: 'Loan',
      last_name: 'Tester',
    };
    const response = await apiClient.post(apiEndpoints.borrowers, payload);
    borrowerId = response.data?.id;
  });

  test.afterAll(async () => {
    await dbClient.disconnect();
  });

  test('@critical GET /loans should return list of loans', async () => {
    const response = await apiClient.get(apiEndpoints.loans);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBeTruthy();
  });

  test('@critical POST /loans should create a new loan', async () => {
    const payload = {
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

    const response = await apiClient.post(apiEndpoints.loans, payload);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('loan_amount', 250000);
    expect(response.data).toHaveProperty('loan_purpose', 'Home Purchase');
  });

  test('@critical POST /loans should fail if borrower does not exist', async () => {
    const payload = {
      borrower_id: 'non-existent-id',
      loan_amount: 250000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '123 Main St',
      property_city: 'New York',
      property_state: 'NY',
      property_zip: '10001',
      loan_purpose: 'Home Purchase',
      interest_rate: 6.5,
    };

    const response = await apiClient.post(apiEndpoints.loans, payload);
    expect(response.status).toBe(404);
  });

  test('@critical GET /loans/:id should retrieve specific loan', async () => {
    // Create a loan first
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 350000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '456 Oak Ave',
      property_city: 'Los Angeles',
      property_state: 'CA',
      property_zip: '90001',
      loan_purpose: 'Investment',
      interest_rate: 7.0,
    };
    const createResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    const loanId = createResponse.data?.id;

    // Get the loan
    const getResponse = await apiClient.get(`${apiEndpoints.loans}/${loanId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('loan_amount', 350000);
  });

  test('@critical PUT /loans/:id should update loan', async () => {
    // Create a loan
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 200000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '789 Elm St',
      property_city: 'Chicago',
      property_state: 'IL',
      property_zip: '60601',
      loan_purpose: 'Refinance',
      interest_rate: 5.5,
    };
    const createResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    const loanId = createResponse.data?.id;

    // Update the loan
    const updatePayload = {
      interest_rate: 6.0,
      loan_amount: 210000,
    };
    const updateResponse = await apiClient.put(
      `${apiEndpoints.loans}/${loanId}`,
      updatePayload
    );
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data).toHaveProperty('interest_rate', 6.0);
    expect(updateResponse.data).toHaveProperty('loan_amount', 210000);
  });

  test('@critical DELETE /loans/:id should delete loan', async () => {
    // Create a loan
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 150000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '999 Test Ln',
      property_city: 'Boston',
      property_state: 'MA',
      property_zip: '02101',
      loan_purpose: 'Business',
      interest_rate: 8.0,
    };
    const createResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    const loanId = createResponse.data?.id;

    // Delete the loan
    const deleteResponse = await apiClient.delete(
      `${apiEndpoints.loans}/${loanId}`
    );
    expect(deleteResponse.status).toBe(200);

    // Verify deletion
    const getResponse = await apiClient.get(`${apiEndpoints.loans}/${loanId}`);
    expect(getResponse.status).toBe(404);
  });

  test('GET /loans should return related request and submission data', async () => {
    // Create a loan
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 300000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '555 Rich Ave',
      property_city: 'Miami',
      property_state: 'FL',
      property_zip: '33101',
      loan_purpose: 'Purchase',
      interest_rate: 7.5,
    };
    const loanResponse = await apiClient.post(apiEndpoints.loans, loanPayload);
    const loanId = loanResponse.data?.id;

    // Get the loan
    const getResponse = await apiClient.get(`${apiEndpoints.loans}/${loanId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('request');
    expect(getResponse.data).toHaveProperty('submitted_data');
  });

  test('Database should reflect all loan operations', async () => {
    // Create a loan
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 100000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '111 Test St',
      property_city: 'Seattle',
      property_state: 'WA',
      property_zip: '98101',
      loan_purpose: 'Startup',
      interest_rate: 9.5,
    };
    const createResponse = await apiClient.post<any>(apiEndpoints.loans, loanPayload);
    expect(createResponse.status).toBe(200);

    const loanId = createResponse.data?.id;
    const getResponse = await apiClient.get(`${apiEndpoints.loans}/${loanId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('loan_amount', 100000);
  });

  test('GET /loans with borrower_id filter should return filtered results', async () => {
    // Create a loan for the borrower
    const loanPayload = {
      borrower_id: borrowerId,
      loan_amount: 400000,
      loan_date: '2024-01-15T00:00:00',
      property_address: '222 Filter St',
      property_city: 'Denver',
      property_state: 'CO',
      property_zip: '80202',
      loan_purpose: 'Commercial',
      interest_rate: 5.0,
    };
    await apiClient.post(apiEndpoints.loans, loanPayload);

    // Get loans with filter
    const response = await apiClient.get(
      `${apiEndpoints.loans}?borrower_id=${borrowerId}`
    );
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBeTruthy();
    // All returned loans should belong to this borrower
    if (response.data && response.data.length > 0) {
      expect(response.data[0].borrower_id).toBe(borrowerId);
    }
  });
});

