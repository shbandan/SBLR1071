// @ts-nocheck
/**
 * Database client utility for testing and data verification.
 * Uses sqlcmd so tests can run against local SQL Server without PostgreSQL.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_CONFIG = {
  server: process.env.DB_SERVER || 'localhost',
  port: process.env.DB_PORT || '1433',
  database: process.env.DB_NAME || 'sblr1071_v2',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

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

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

function applyParameters(sql: string, values?: unknown[]): string {
  if (!values || values.length === 0) {
    return sql;
  }

  return sql.replace(/\$(\d+)/g, (_, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    if (index < 0 || index >= values.length) {
      throw new Error(`SQL parameter index out of bounds: $${rawIndex}`);
    }
    return escapeSqlValue(values[index]);
  });
}

function parseSqlcmdTable(output: string): Record<string, unknown>[] {
  const cleanedLines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .filter((line) => !/^\(\d+ rows affected\)$/.test(line.trim()))
    .filter((line) => !/^-{3,}(\s+-{3,})*$/.test(line.trim()));

  if (cleanedLines.length === 0) {
    return [];
  }

  const headers = cleanedLines[0].split('|').map((h) => h.trim());
  const rows = cleanedLines.slice(1);

  return rows.map((row) => {
    const cells = row.split('|');
    const record: Record<string, unknown> = {};

    headers.forEach((header, idx) => {
      const cellValue = (cells[idx] || '').trim();
      if (cellValue === 'NULL') {
        record[header] = null;
      } else {
        record[header] = cellValue;
      }
    });

    return record;
  });
}

class DatabaseClient {
  async connect(): Promise<void> {
    await this.query('SELECT 1 AS ok');
  }

  async disconnect(): Promise<void> {
    // sqlcmd is stateless per query; nothing to close.
  }

  async query<T = unknown>(sql: string, values?: unknown[]): Promise<T[]> {
    const renderedSql = applyParameters(sql, values);

    const args = [
      '-S',
      DB_CONFIG.port ? `${DB_CONFIG.server},${DB_CONFIG.port}` : DB_CONFIG.server,
      '-d',
      DB_CONFIG.database,
      '-C',
      '-W',
      '-s',
      '|',
      '-Q',
      `SET NOCOUNT ON; ${renderedSql}`,
    ];

    if (DB_CONFIG.user && DB_CONFIG.password) {
      args.push('-U', DB_CONFIG.user, '-P', DB_CONFIG.password);
    } else {
      args.push('-E');
    }

    try {
      const { stdout } = await execFileAsync('sqlcmd', args, {
        maxBuffer: 10 * 1024 * 1024,
      });
      return parseSqlcmdTable(stdout) as T[];
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(`sqlcmd query failed: ${details}`);
    }
  }

  async queryOne<T = unknown>(sql: string, values?: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, values);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, values?: unknown[]): Promise<number> {
    const result = await this.queryOne<{ affected: number | string }>(
      `${sql}; SELECT @@ROWCOUNT AS affected`,
      values
    );
    return toNumber(result?.affected);
  }

  async clearAllTables(): Promise<void> {
    await this.execute('DELETE FROM form_1071_submissions');
    await this.execute('DELETE FROM form_1071_requests');
    await this.execute('DELETE FROM loans');
    await this.execute('DELETE FROM borrowers');
  }
}

export const dbClient = new DatabaseClient();

// Database Queries
export const dbQueries = {
  async getBorrowerCount(): Promise<number> {
    const result = await dbClient.queryOne<{ count: number | string }>(
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
    const result = await dbClient.queryOne<{ count: number | string }>(
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
    const result = await dbClient.queryOne<{ count: number | string }>(
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
    const result = await dbClient.queryOne<{ count: number | string }>(
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
