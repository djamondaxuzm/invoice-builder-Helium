import type { DatabaseType } from '../enums/databaseType';

export type DatabaseAdapter = {
  type: DatabaseType;
  withIsolatedConnection?: <T>(work: (connection: DatabaseAdapter) => Promise<T>) => Promise<T>;
  run: (sql: string, params?: unknown[], returningId?: boolean) => Promise<number>;
  get: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | null>;
  all: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  close: () => Promise<void>;
};
