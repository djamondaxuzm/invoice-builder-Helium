import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type {
  ContractSummary,
  SavedContract,
  SaveContractRequest,
  DeleteContractRequest,
  ContractTermsTemplate
} from '../types/contracts';
import { defaultContractTerms, validateContractDraft, validateContractTerms } from '../utils/contracts';
import { mapDatabaseError } from '../utils/errorFunctions';

type Row = ContractSummary & { payload: string; signed: boolean | number };
const summary = (row: ContractSummary): ContractSummary => ({ ...row, signed: Boolean(row.signed) });
const decode = ({ payload, ...row }: Row): SavedContract => ({
  ...summary(row),
  draft: validateContractDraft(JSON.parse(payload))
});
const validId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;

type TemplateRow = { revision: number; payload: string };
const decodeTemplate = (row: TemplateRow): ContractTermsTemplate => ({
  revision: row.revision,
  terms: validateContractTerms(JSON.parse(row.payload))
});

export const getContractTermsTemplate = async (db: DatabaseAdapter) => {
  try {
    const row = await db.get<TemplateRow>(
      'SELECT "revision", "payload" FROM contract_terms_templates WHERE "singleton" = 1'
    );
    return { success: true, data: row ? decodeTemplate(row) : { revision: 0, terms: defaultContractTerms() } };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const saveContractTermsTemplate = async (db: DatabaseAdapter, request: ContractTermsTemplate) => {
  let terms;
  try {
    terms = validateContractTerms(request?.terms);
    if (!Number.isSafeInteger(request.revision) || request.revision < 0) throw new Error('Invalid terms revision.');
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Invalid standard terms.' };
  }
  try {
    const params = [JSON.stringify(terms), new Date().toISOString()];
    const row =
      request.revision === 0
        ? await db.get<TemplateRow>(
            `INSERT INTO contract_terms_templates ("revision", "payload", "updatedAt")
          VALUES (1, ?, ?) ON CONFLICT ("singleton") DO NOTHING RETURNING "revision", "payload"`,
            params
          )
        : await db.get<TemplateRow>(
            `UPDATE contract_terms_templates SET "payload" = ?, "updatedAt" = ?, "revision" = "revision" + 1
          WHERE "singleton" = 1 AND "revision" = ? RETURNING "revision", "payload"`,
            [...params, request.revision]
          );
    return row
      ? { success: true, data: decodeTemplate(row) }
      : { success: false, message: 'Standard terms changed in another window. Reopen the template before saving.' };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const listContracts = async (db: DatabaseAdapter, clientId?: number) => {
  try {
    if (clientId !== undefined && !validId(clientId)) return { success: false, message: 'Invalid client.' };
    const rows = await db.all<ContractSummary>(
      'SELECT "id", "revision", "title", "date", "clientId", "clientName", "signed", "updatedAt" FROM contracts' +
        (clientId === undefined ? '' : ' WHERE "clientId" = ?') +
        ' ORDER BY "date" DESC, "id" DESC',
      clientId === undefined ? [] : [clientId]
    );
    return { success: true, data: rows.map(summary) };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const getContract = async (db: DatabaseAdapter, id: number) => {
  try {
    if (!validId(id)) return { success: false, message: 'Invalid contract.' };
    const row = await db.get<Row>('SELECT * FROM contracts WHERE "id" = ?', [id]);
    return row ? { success: true, data: decode(row) } : { success: false, message: 'Contract not found.' };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const deleteContract = async (db: DatabaseAdapter, request: DeleteContractRequest) => {
  if (!validId(request?.id) || !validId(request?.revision))
    return { success: false, message: 'Invalid contract revision.' };
  try {
    // Confirmed revision only: another window may have edited or signed it meanwhile.
    const row = await db.get<{ id: number }>('DELETE FROM contracts WHERE "id" = ? AND "revision" = ? RETURNING "id"', [
      request.id,
      request.revision
    ]);
    return row
      ? { success: true, data: row }
      : {
          success: false,
          message:
            'This contract changed or was already deleted. Close this dialog and reopen the contract before deleting.'
        };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const saveContract = async (db: DatabaseAdapter, request: SaveContractRequest) => {
  let draft;
  try {
    draft = validateContractDraft(request?.draft);
    if (request.id !== undefined && (!validId(request.id) || !validId(request.revision)))
      throw new Error('Invalid contract revision.');
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Invalid contract.' };
  }
  try {
    const values = [
      draft.title.trim(),
      draft.date,
      draft.client?.sourceId ?? null,
      draft.client?.name ?? '',
      draft.signed ? 1 : 0,
      JSON.stringify({ ...draft, title: draft.title.trim() }),
      new Date().toISOString()
    ];
    let row: Row | null;
    if (request.id === undefined) {
      row = await db.get<Row>(
        `INSERT INTO contracts ("title", "date", "clientId", "clientName", "signed", "payload", "updatedAt")
        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        values
      );
    } else {
      // Atomic compare-and-swap prevents a stale editor overwriting a newer save.
      row = await db.get<Row>(
        `UPDATE contracts SET "title" = ?, "date" = ?, "clientId" = ?, "clientName" = ?,
        "signed" = ?, "payload" = ?, "updatedAt" = ?, "revision" = "revision" + 1
        WHERE "id" = ? AND "revision" = ? RETURNING *`,
        [...values, request.id, request.revision]
      );
    }
    return row
      ? { success: true, data: decode(row) }
      : {
          success: false,
          message:
            'This contract changed in another window. Reopen it before saving; your current edits have been kept.'
        };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
