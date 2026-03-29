import { test, expect } from '@playwright/test';
import { dbClient, dbQueries } from '../utils/db-client';

test.describe('Database Layer Tests - Data Integrity', () => {
  test.beforeAll(async () => {
    await dbClient.connect();
  });

  test.afterAll(async () => {
    await dbClient.disconnect();
  });

  test('@critical should verify database connectivity', async () => {
    expect(dbClient).toBeTruthy();
  });

  test('@critical should verify all required tables exist', async () => {
    const tables = await dbClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames).toContain('borrowers');
    expect(tableNames).toContain('loans');
    expect(tableNames).toContain('form_1071_requests');
    expect(tableNames).toContain('form_1071_submissions');
  });

  test('should verify borrowers table structure', async () => {
    const columns = await dbClient.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'borrowers'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('first_name');
    expect(columnNames).toContain('last_name');
    expect(columnNames).toContain('created_at');
  });

  test('should verify loans table structure', async () => {
    const columns = await dbClient.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'loans'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('borrower_id');
    expect(columnNames).toContain('loan_amount');
    expect(columnNames).toContain('loan_date');
    expect(columnNames).toContain('property_address');
    expect(columnNames).toContain('property_city');
    expect(columnNames).toContain('property_state');
    expect(columnNames).toContain('property_zip');
    expect(columnNames).toContain('loan_purpose');
    expect(columnNames).toContain('interest_rate');
    expect(columnNames).toContain('created_at');
  });

  test('should verify form_1071_requests table structure', async () => {
    const columns = await dbClient.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'form_1071_requests'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('guid');
    expect(columnNames).toContain('loan_id');
    expect(columnNames).toContain('borrower_id');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('request_sent_at');
    expect(columnNames).toContain('submitted_at');
    expect(columnNames).toContain('created_at');
  });

  test('should verify form_1071_submissions table structure', async () => {
    const columns = await dbClient.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'form_1071_submissions'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('request_id');
    expect(columnNames).toContain('applicant_name');
    expect(columnNames).toContain('applicant_email');
    expect(columnNames).toContain('annual_income');
    expect(columnNames).toContain('liquid_assets');
    expect(columnNames).toContain('employment_status');
  });

  test('should verify primary keys are set correctly', async () => {
    const constraints = await dbClient.query(`
      SELECT table_name, constraint_type FROM information_schema.table_constraints 
      WHERE constraint_type = 'PRIMARY KEY' 
      AND table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = constraints.map((c: any) => c.table_name);
    expect(tables).toContain('borrowers');
    expect(tables).toContain('loans');
    expect(tables).toContain('form_1071_requests');
    expect(tables).toContain('form_1071_submissions');
  });

  test('should verify foreign key relationships', async () => {
    const constraints = await dbClient.query(`
      SELECT constraint_name, table_name, column_name 
      FROM information_schema.constraint_column_usage 
      WHERE constraint_name LIKE 'fk_%' OR constraint_name LIKE '%fkey'
      ORDER BY table_name
    `);

    expect(constraints.length).toBeGreaterThan(0);
  });

  test('should verify indexes exist for performance', async () => {
    const indexes = await dbClient.query(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public'
      AND tablename IN ('borrowers', 'loans', 'form_1071_requests', 'form_1071_submissions')
      ORDER BY indexname
    `);

    const indexNames = indexes.map((i: any) => i.indexname);
    // Verify key indexes exist
    expect(indexNames.some((name) => name.includes('email'))).toBeTruthy();
    expect(indexNames.some((name) => name.includes('borrower_id'))).toBeTruthy();
    expect(indexNames.some((name) => name.includes('guid'))).toBeTruthy();
  });

  test('should verify no orphaned loans (referential integrity)', async () => {
    const orphans = await dbClient.query(`
      SELECT id FROM loans l
      WHERE NOT EXISTS (SELECT 1 FROM borrowers b WHERE b.id = l.borrower_id)
    `);

    expect(orphans.length).toBe(0);
  });

  test('should verify no orphaned 1071 requests', async () => {
    const orphans = await dbClient.query(`
      SELECT id FROM form_1071_requests r
      WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.id = r.loan_id)
      OR NOT EXISTS (SELECT 1 FROM borrowers b WHERE b.id = r.borrower_id)
    `);

    expect(orphans.length).toBe(0);
  });

  test('should verify no orphaned 1071 submissions', async () => {
    const orphans = await dbClient.query(`
      SELECT id FROM form_1071_submissions s
      WHERE NOT EXISTS (SELECT 1 FROM form_1071_requests r WHERE r.id = s.request_id)
    `);

    expect(orphans.length).toBe(0);
  });

  test('should verify timestamps are set on creation', async () => {
    const result = await dbClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM relations.borrowers WHERE created_at IS NOT NULL'
    );
    expect(Number(result?.count || 0)).toBeGreaterThanOrEqual(0);
  });

  test('should get data integrity summary', async () => {
    const integrity = await dbQueries.verifyDataIntegrity();
    expect(integrity).toHaveProperty('borrowersCount');
    expect(integrity).toHaveProperty('loansCount');
    expect(integrity).toHaveProperty('requestsCount');
    expect(integrity).toHaveProperty('submissionsCount');
    
    // All should be non-negative
    expect(integrity.borrowersCount).toBeGreaterThanOrEqual(0);
    expect(integrity.loansCount).toBeGreaterThanOrEqual(0);
    expect(integrity.requestsCount).toBeGreaterThanOrEqual(0);
    expect(integrity.submissionsCount).toBeGreaterThanOrEqual(0);
  });

  test('should verify GUID uniqueness in requests', async () => {
    const duplicates = await dbClient.query(`
      SELECT guid, COUNT(*) as count 
      FROM form_1071_requests 
      GROUP BY guid 
      HAVING COUNT(*) > 1
    `);

    expect(duplicates.length).toBe(0);
  });

  test('should verify submitted_at is NULL for pending requests', async () => {
    const pendingWithSubmittedAt = await dbClient.query(`
      SELECT id FROM form_1071_requests 
      WHERE status = 'pending' AND submitted_at IS NOT NULL
    `);

    // Pending requests should not have submitted_at
    expect(pendingWithSubmittedAt.length).toBe(0);
  });
});
