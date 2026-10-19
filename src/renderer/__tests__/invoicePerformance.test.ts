import { formEqual } from '../shared/utils/formEqual';
import { invoiceSavePayload } from '../shared/utils/invoiceSavePayload';
import { toDataUrl } from '../shared/utils/dataUrlFunctions';
import type { InvoiceUpdate } from '../shared/types/invoice';

it('detects edits and reversions without enumerating unchanged receipt bytes', () => {
  const data = new Uint8Array(1024 * 1024);
  const original = { note: 'before', images: [{ data }] };
  const edited = { ...original, note: 'after' };
  expect(formEqual(original, edited)).toBe(false);
  expect(formEqual(original, { ...edited, note: 'before' })).toBe(true);
  expect(formEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  expect(formEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  expect(formEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
  expect(formEqual({ a: undefined }, {})).toBe(false);
  expect(formEqual(new Uint8Array([1]).buffer, new Uint8Array([2]).buffer)).toBe(false);
  expect(formEqual(new File(['a'], 'a.png'), new File(['b'], 'a.png'))).toBe(false);
});

it('sends references for saved receipts and includes bytes for new ones without changing the form', () => {
  const saved = {
    id: 3,
    parentInvoiceId: 7,
    fileName: 'saved.png',
    fileType: 'image/png',
    fileSize: 2,
    data: new Uint8Array([1, 2])
  };
  const added = { id: 123456, fileName: 'new.png', fileType: 'image/png', fileSize: 1, data: new Uint8Array([3]) };
  const form: InvoiceUpdate = { id: 7, invoiceAttachments: [saved, added] };
  const result = invoiceSavePayload(form);
  expect(result.invoiceAttachments![0].retainExistingData).toBe(true);
  expect(result.invoiceAttachments![0].data.byteLength).toBe(0);
  expect(result.invoiceAttachments![1]).toBe(added);
  expect(saved.data.byteLength).toBe(2);
  expect(invoiceSavePayload({ ...form, id: 8 }).invoiceAttachments![0]).toBe(saved);
});

it('reuses image conversion for unchanged bytes and separates MIME types and new buffers', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const first = toDataUrl(bytes, 'image/png');
  expect(toDataUrl(bytes, 'image/png')).toBe(first);
  expect(await first).toBe('data:image/png;base64,AQID');
  expect(await toDataUrl(bytes, 'image/jpeg')).toBe('data:image/jpeg;base64,AQID');
  expect(toDataUrl(new Uint8Array(bytes), 'image/png')).not.toBe(first);
});
