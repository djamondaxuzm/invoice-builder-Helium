import { Pool, type PoolClient } from 'pg';
import sqlite3 from 'sqlite3';
import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import {
  boolToInt,
  convertBooleanFields,
  convertBooleanFieldsArray,
  convertDateFields,
  convertDateFieldsArray
} from '../utils/dbHelper';

const convertQuestionToDollar = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export const createSqliteAdapter = (db: sqlite3.Database): DatabaseAdapter => {
  return {
    type: DatabaseType.sqlite,
    withIsolatedConnection: async work => {
      // Maintenance must not join a concurrent invoice save's transaction.
      // In-memory adapters are test-only and cannot open the same database twice.
      const databases = await new Promise<{ name: string; file: string }[]>((resolve, reject) =>
        db.all('PRAGMA database_list', (error, rows) =>
          error ? reject(error) : resolve(rows as { name: string; file: string }[])
        )
      );
      const file = databases.find(row => row.name === 'main')?.file;
      if (!file) return work(createSqliteAdapter(db));
      const connection = await new Promise<sqlite3.Database>((resolve, reject) => {
        const opened = new sqlite3.Database(file, sqlite3.OPEN_READWRITE, error =>
          error ? reject(error) : resolve(opened)
        );
      });
      connection.configure('busyTimeout', 5000);
      const adapter = createSqliteAdapter(connection);
      try {
        return await work(adapter);
      } finally {
        await adapter.close();
      }
    },
    run: (sql: string, params: unknown[] = [], returningId = false) =>
      new Promise<number>((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(returningId ? this.lastID : -1);
        });
      }),
    get: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      new Promise<T | null>((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          const convertedRow = convertBooleanFields(row as Record<string, unknown>);
          resolve(convertedRow as T);
        });
      }),
    all: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      new Promise<T[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          const convertedRows = convertBooleanFieldsArray(rows as Record<string, unknown>[]);
          resolve(convertedRows as T[]);
        });
      }),
    query: async (sql: string, params: unknown[] = []) => {
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          const convertedRows = convertBooleanFieldsArray(rows as Record<string, unknown>[]);
          resolve(convertedRows);
        });
      });
      return { rows };
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        (db as sqlite3.Database).close(err => (err ? reject(err) : resolve()));
      })
  };
};

export const createPostgresAdapter = (connectionString: string): DatabaseAdapter => {
  const pool = new Pool({ connectionString });
  let clientInTransaction: PoolClient | null = null;

  const acquireClient = async () => {
    if (clientInTransaction) return clientInTransaction;
    clientInTransaction = await pool.connect();
    return clientInTransaction;
  };

  const releaseClient = async () => {
    if (clientInTransaction) {
      try {
        clientInTransaction.release();
      } catch {
        throw new Error(`error.failedPGrelease`);
      }

      clientInTransaction = null;
    }
  };

  const runQuery = async (sql: string, params: unknown[] = []) => {
    const text = convertQuestionToDollar(sql);
    const trimmed = text.trim().toUpperCase();
    if (trimmed === 'BEGIN' || trimmed.startsWith('BEGIN ')) {
      const client = await acquireClient();
      await client.query(text, params);
      return { rows: [], rowCount: 0 };
    }
    if (trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      if (!clientInTransaction) {
        return { rows: [], rowCount: 0 };
      }
      try {
        const res = await clientInTransaction.query(text, params);
        return res;
      } finally {
        await releaseClient();
      }
    }

    if (clientInTransaction) {
      return clientInTransaction.query(text, params);
    }

    return pool.query(text, params);
  };

  return {
    type: DatabaseType.postgre,
    withIsolatedConnection: async work => {
      const adapter = createPostgresAdapter(connectionString);
      try {
        return await work(adapter);
      } finally {
        await adapter.close();
      }
    },
    run: async (sql: string, params: unknown[] = [], returningId = false) => {
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');
      if (returningId && isInsert && !sql.toUpperCase().includes('RETURNING')) {
        sql += ' RETURNING id';
      }

      if (isInsert || isUpdate) {
        params = params.map(boolToInt);
      }

      const res = await runQuery(sql, params);
      if (isInsert && returningId) {
        return res.rows[0]?.id ?? -1;
      }
      return res.rowCount ?? 0;
    },
    get: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      if (!res.rows[0]) return null;
      const convertedBooleanRow = convertBooleanFields(res.rows[0] as Record<string, unknown>);
      const convertedDateRow = convertDateFields(convertedBooleanRow as Record<string, unknown>);

      return convertedDateRow as T;
    },
    all: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      const convertedBooleanRow = convertBooleanFieldsArray(res.rows as Record<string, unknown>[]);
      const convertedDateRow = convertDateFieldsArray(convertedBooleanRow as Record<string, unknown>[]);

      return convertedDateRow as T[];
    },
    query: async (sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      const convertedBooleanRow = convertBooleanFieldsArray(res.rows as Record<string, unknown>[]);
      const convertedDateRow = convertDateFieldsArray(convertedBooleanRow as Record<string, unknown>[]);

      return { rows: convertedDateRow };
    },
    close: async () => {
      await releaseClient();
      await pool.end();
    }
  };
};
