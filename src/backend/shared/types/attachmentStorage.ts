import type { Response } from './response';

export type AttachmentManifest = {
  databaseToken: string;
  attachments: { id: number; bytes: number }[];
  canCompact: boolean;
};
export type AttachmentReadRequest = { databaseToken: string; id: number };
export type StoredAttachment = {
  id: number;
  fileName: string;
  fileType: string;
  data: Uint8Array;
  fingerprint: string;
};
export type AttachmentReplaceRequest = AttachmentReadRequest & {
  fingerprint: string;
  data: Uint8Array;
  fileType: string;
};
export type AttachmentReplacement = { updated: boolean; beforeBytes: number; afterBytes: number };
export type StorageCompaction = { beforeBytes: number; afterBytes: number };
export type AttachmentStorageApi = {
  getAttachmentManifest: () => Promise<Response<AttachmentManifest>>;
  readStoredAttachment: (request: AttachmentReadRequest) => Promise<Response<StoredAttachment | null>>;
  replaceStoredAttachment: (request: AttachmentReplaceRequest) => Promise<Response<AttachmentReplacement>>;
  compactAttachmentStorage: (databaseToken: string) => Promise<Response<StorageCompaction>>;
};
