import { test, expect } from '@playwright/test';
import { apiClient } from '../utils/api-client';
import { apiEndpoints } from '../fixtures/test-data';

test.describe('API Health Checks', () => {
  test('@smoke should return health check status', async () => {
    const response = await apiClient.get(apiEndpoints.health);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'ok');
  });

  test('backend should be running and responsive', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });
});
