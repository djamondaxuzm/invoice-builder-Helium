import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType } from '../utils/dbHelper';

export const createContractTemplatesSchema = async (db: DatabaseAdapter) => {
  await db.run(`CREATE TABLE IF NOT EXISTS contract_terms_templates (
    "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
    "singleton" INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK ("singleton" = 1),
    "revision" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`);
};

export const createContractsSchema = async (db: DatabaseAdapter) => {
  // Intentionally independent of catalog foreign keys: historical drafts survive
  // catalog edits, archiving and deletion without changing their agreed content.
  await db.run(`CREATE TABLE IF NOT EXISTS contracts (
    "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clientId" INTEGER,
    "clientName" TEXT NOT NULL,
    "signed" INTEGER NOT NULL DEFAULT 0 CHECK ("signed" IN (0, 1)),
    "payload" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`);
  await db.run('CREATE INDEX IF NOT EXISTS idx_contracts_client_date ON contracts("clientId", "date")');
  await createContractTemplatesSchema(db);
};
