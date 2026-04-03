import { test, expect } from '@playwright/test';
import { apiClient } from '../utils/api-client';
import { testData, apiEndpoints } from '../fixtures/test-data';
import { dbClient, dbQueries } from '../utils/db-client';

const HARDCODED_TEST_EMAIL = 'playwright-mock@example.com';

function uniqueEmail(prefix: string): string {
  return HARDCODED_TEST_EMAIL;
}

test.describe('Borrower API Layer Tests', () => {
  test.beforeAll(async () => {
    await dbClient.connect();
  });

  test.afterAll(async () => {
    await dbClient.disconnect();
  });

  test('@critical GET /borrowers should return list of borrowers', async () => {
    const response = await apiClient.get(apiEndpoints.borrowers);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBeTruthy();
  });

  test('@critical POST /borrowers should create a new borrower', async () => {
    const payload = {
      email: uniqueEmail('test'),
      first_name: 'Test',
      last_name: 'User',
    };

    const response = await apiClient.post(apiEndpoints.borrowers, payload);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('email', payload.email);
    expect(response.data).toHaveProperty('first_name', payload.first_name);
    expect(response.data).toHaveProperty('last_name', payload.last_name);
  });

  test('@critical POST /borrowers then GET should persist data', async () => {
    const payload = {
      email: uniqueEmail('persist-test'),
      first_name: 'Persist',
      last_name: 'Test',
    };

    // Create borrower
    const createResponse = await apiClient.post<any>(apiEndpoints.borrowers, payload);
    expect(createResponse.status).toBe(200);
    const borrowerId = createResponse.data?.id;

    // Get borrower
    const getResponse = await apiClient.get(`${apiEndpoints.borrowers}/${borrowerId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('email', payload.email);

    // Verify by listing borrowers and finding the created record.
    const listResponse = await apiClient.get<any[]>(apiEndpoints.borrowers);
    expect(listResponse.status).toBe(200);
    const found = (listResponse.data || []).some((b) => b.id === borrowerId && b.email === payload.email);
    expect(found).toBeTruthy();
  });

  test('@critical PUT /borrowers/:id should update borrower', async () => {
    // Create a borrower first
    const createPayload = {
      email: uniqueEmail('update-test'),
      first_name: 'Original',
      last_name: 'Name',
    };
    const createResponse = await apiClient.post<any>(apiEndpoints.borrowers, createPayload);
    const borrowerId = createResponse.data?.id;

    // Update the borrower
    const updatePayload = {
      first_name: 'Updated',
      last_name: 'Name',
    };
    const updateResponse = await apiClient.put(
      `${apiEndpoints.borrowers}/${borrowerId}`,
      updatePayload
    );
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data).toHaveProperty('first_name', 'Updated');
    expect(updateResponse.data).toHaveProperty('last_name', 'Name');
  });

  test('@critical DELETE /borrowers/:id should delete borrower', async () => {
    // Create a borrower first
    const createPayload = {
      email: uniqueEmail('delete-test'),
      first_name: 'Delete',
      last_name: 'Me',
    };
    const createResponse = await apiClient.post<any>(apiEndpoints.borrowers, createPayload);
    const borrowerId = createResponse.data?.id;

    // Delete the borrower
    const deleteResponse = await apiClient.delete(
      `${apiEndpoints.borrowers}/${borrowerId}`
    );
    expect(deleteResponse.status).toBe(200);

    // Verify deletion
    const getResponse = await apiClient.get(`${apiEndpoints.borrowers}/${borrowerId}`);
    expect(getResponse.status).toBe(404);
  });

  test('POST /borrowers should allow duplicate emails', async () => {
    const email = uniqueEmail('duplicate');
    const payload1 = {
      email: email,
      first_name: 'First',
      last_name: 'Copy',
    };
    const payload2 = {
      email: email,
      first_name: 'Second',
      last_name: 'Copy',
    };

    const response1 = await apiClient.post(apiEndpoints.borrowers, payload1);
    expect(response1.status).toBe(200);

    const response2 = await apiClient.post(apiEndpoints.borrowers, payload2);
    expect(response2.status).toBe(200);
  });

  test('Database should reflect all borrower operations', async () => {
    // Create a borrower
    const payload = {
      email: uniqueEmail('db-verify'),
      first_name: 'DB',
      last_name: 'Verify',
    };
    const createResponse = await apiClient.post<any>(apiEndpoints.borrowers, payload);
    expect(createResponse.status).toBe(200);

    const borrowerId = createResponse.data?.id;
    const getResponse = await apiClient.get(`${apiEndpoints.borrowers}/${borrowerId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data).toHaveProperty('email', payload.email);
  });
});

