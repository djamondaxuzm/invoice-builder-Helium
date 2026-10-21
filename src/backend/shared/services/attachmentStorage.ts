import { createHash, randomUUID } from 'node:crypto';
import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { Response } from '../types/response';
import type {
  AttachmentManifest,
  AttachmentReadRequest,
  AttachmentReplaceRequest,
  AttachmentReplacement,
  StoredAttachment,
  StorageCompaction
} from '../types/attachmentStorage';

const tokens = new WeakMap<DatabaseAdapter, string>();
const databaseToken = (db: DatabaseAdapter) => {
  let token = tokens.get(db);
  if (!token) {
    token = randomUUID();
    tokens.set(db, token);
  }
  return token;
};
const verifyDatabase = (db: DatabaseAdapter, token: string) => {
  if (!token || token !== databaseToken(db))
    throw new Error('The open database changed. Scan attachments again before continuing.');
};
const verifyRequest = (db: DatabaseAdapter, request: AttachmentReadRequest) => {
  verifyDatabase(db, request?.databaseToken);
  if (!Number.isSafeInteger(request.id) || request.id <= 0) throw new Error('Invalid attachment ID.');
};
const respond = async <T>(work: () => Promise<T>): Promise<Response<T>> => {
  try {
    return { success: true, data: await work() };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Attachment storage operation failed.' };
  }
};
const onStorage = <T>(db: DatabaseAdapter, work: (connection: DatabaseAdapter) => Promise<T>) =>
  respond(() => (db.withIsolatedConnection ? db.withIsolatedConnection(work) : work(db)));

type Row = {
  id: number;
  parentInvoiceId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: Uint8Array;
};
const fingerprint = (row: Row) =>
  createHash('sha256')
    .update(JSON.stringify([row.id, row.parentInvoiceId, row.fileName, row.fileType, row.fileSize]))
    .update(row.data)
    .digest('hex');

export const getAttachmentManifest = (db: DatabaseAdapter): Promise<Response<AttachmentManifest>> =>
  onStorage(db, async connection => ({
    databaseToken: databaseToken(db),
    // No invoice filter: includes archived invoices and quotations. No image bytes cross IPC here.
    attachments: await connection.all<{ id: number; bytes: number }>(
      'SELECT "id", length("data") AS "bytes" FROM attachments ORDER BY "id"'
    ),
    canCompact: db.type === DatabaseType.sqlite
  }));

export const readStoredAttachment = (
  db: DatabaseAdapter,
  request: AttachmentReadRequest
): Promise<Response<StoredAttachment | null>> =>
  onStorage(db, async connection => {
    verifyRequest(db, request);
    const row = await connection.get<Row>('SELECT * FROM attachments WHERE "id" = ?', [request.id]);
    return row
      ? { id: row.id, fileName: row.fileName, fileType: row.fileType, data: row.data, fingerprint: fingerprint(row) }
      : null;
  });

const validImage = (data: Uint8Array, mime: string) => {
  if (mime === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte);
  return (
    mime === 'image/jpeg' &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255 &&
    data[data.length - 2] === 255 &&
    data[data.length - 1] === 217
  );
};

export const replaceStoredAttachment = (
  db: DatabaseAdapter,
  request: AttachmentReplaceRequest
): Promise<Response<AttachmentReplacement>> =>
  onStorage(db, async connection => {
    verifyRequest(db, request);
    if (
      !(request.data instanceof Uint8Array) ||
      !request.data.length ||
      request.data.length > 20 * 1024 * 1024 ||
      !validImage(request.data, request.fileType) ||
      typeof request.fingerprint !== 'string'
    )
      throw new Error('Invalid compressed image. The stored attachment was not changed.');
    const row = await connection.get<Row>('SELECT * FROM attachments WHERE "id" = ?', [request.id]);
    if (!row || fingerprint(row) !== request.fingerprint) return { updated: false, beforeBytes: 0, afterBytes: 0 };
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(row.fileType) || request.data.length > row.data.length * 0.9)
      throw new Error('The replacement must save at least 10% of the original image size.');
    const extension = request.fileType === 'image/jpeg' ? 'jpg' : 'png';
    const matchesExtension = extension === 'jpg' ? /\.jpe?g$/i.test(row.fileName) : /\.png$/i.test(row.fileName);
    const name = matchesExtension ? row.fileName : row.fileName.replace(/\.[^.]+$/, '') + '.' + extension;
    // A single atomic conditional statement: never join an invoice transaction or resave financial fields.
    // Compare bytes as well as metadata to catch an edit between our read and write.
    const updated = await connection.get<{ id: number }>(
      'UPDATE attachments SET "data" = ?, "fileType" = ?, "fileName" = ?, "fileSize" = ?, "updatedAt" = ? ' +
        'WHERE "id" = ? AND "parentInvoiceId" = ? AND "fileName" = ? AND "fileType" = ? AND "fileSize" = ? AND "data" = ? RETURNING "id"',
      [
        Buffer.from(request.data),
        request.fileType,
        name,
        request.data.length,
        new Date().toISOString(),
        row.id,
        row.parentInvoiceId,
        row.fileName,
        row.fileType,
        row.fileSize,
        Buffer.from(row.data)
      ]
    );
    return {
      updated: !!updated,
      beforeBytes: updated ? row.data.length : 0,
      afterBytes: updated ? request.data.length : 0
    };
  });

const allocatedBytes = async (db: DatabaseAdapter) => {
  const count = await db.get<{ page_count: number }>('PRAGMA page_count');
  const size = await db.get<{ page_size: number }>('PRAGMA page_size');
  return (count?.page_count ?? 0) * (size?.page_size ?? 0);
};
export const compactAttachmentStorage = (db: DatabaseAdapter, token: string): Promise<Response<StorageCompaction>> =>
  onStorage(db, async connection => {
    verifyDatabase(db, token);
    if (db.type !== DatabaseType.sqlite) throw new Error('Space reclamation is available for SQLite databases.');
    const beforeBytes = await allocatedBytes(connection);
    // SQLite performs VACUUM atomically; a busy database or disk error leaves saved attachments intact.
    await connection.run('VACUUM');
    return { beforeBytes, afterBytes: await allocatedBytes(connection) };
  });
