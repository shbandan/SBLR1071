/**
 * Database client utility for testing and data verification
 */

import { Client } from 'pg';

const DB_CONFIG = {
  user: process.env.DB_USER || 'sband',
  password: process.env.DB_PASSWORD || 'admin',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sblr1071_v2',
};

class DatabaseClient {
  private client: Client | null = null;

  async connect(): Promise<void> {
    this.client = new Client(DB_CONFIG);
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async query<T = unknown>(sql: string, values?: unknown[]): Promise<T[]> {
    if (!this.client) {
      throw new Error('Database client not connected');
    }
    const result = await this.client.query(sql, values);
    return result.rows as T[];
  }

  async queryOne<T = unknown>(sql: string, values?: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, values);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, values?: unknown[]): Promise<number> {
    if (!this.client) {
      throw new Error('Database client not connected');
    }
    const result = await this.client.query(sql, values);
    return result.rowCount || 0;
  }

  async clearAllTables(): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not connected');
    }

    // Disable foreign key constraints temporarily
    await this.client.query('TRUNCATE TABLE form_1071_submissions CASCADE');
    await this.client.query('TRUNCATE TABLE form_1071_requests CASCADE');
    await this.client.query('TRUNCATE TABLE loans CASCADE');
    await this.client.query('TRUNCATE TABLE borrowers CASCADE');
  }
}

export const dbClient = new DatabaseClient();

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Database Queries
export const dbQueries = {
  async getBorrowerCount(): Promise<number> {
    const result = await dbClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM borrowers'
    );
    return toNumber(result?.count);
  },

  async getBorrowerByEmail(email: string): Promise<unknown> {
    return dbClient.queryOne(
      'SELECT * FROM borrowers WHERE email = $1',
      [email]
    );
  },

  async getLoanCount(): Promise<number> {
    const result = await dbClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM loans'
    );
    return toNumber(result?.count);
  },

  async getLoanByBorrowerId(borrowerId: string): Promise<unknown[]> {
    return dbClient.query(
      'SELECT * FROM loans WHERE borrower_id = $1',
      [borrowerId]
    );
  },

  async getForm1071RequestCount(): Promise<number> {
    const result = await dbClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM form_1071_requests'
    );
    return toNumber(result?.count);
  },

  async getForm1071RequestByGuid(guid: string): Promise<unknown> {
    return dbClient.queryOne(
      'SELECT * FROM form_1071_requests WHERE guid = $1',
      [guid]
    );
  },

  async getForm1071SubmissionCount(): Promise<number> {
    const result = await dbClient.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM form_1071_submissions'
    );
    return toNumber(result?.count);
  },

  async getForm1071SubmissionByRequestId(requestId: string): Promise<unknown> {
    return dbClient.queryOne(
      'SELECT * FROM form_1071_submissions WHERE request_id = $1',
      [requestId]
    );
  },

  async verifyDataIntegrity(): Promise<{
    borrowersCount: number;
    loansCount: number;
    requestsCount: number;
    submissionsCount: number;
  }> {
    return {
      borrowersCount: await dbQueries.getBorrowerCount(),
      loansCount: await dbQueries.getLoanCount(),
      requestsCount: await dbQueries.getForm1071RequestCount(),
      submissionsCount: await dbQueries.getForm1071SubmissionCount(),
    };
  },
};
