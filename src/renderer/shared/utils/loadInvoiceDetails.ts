import { getApi } from '../api/restApi';
import type { Invoice } from '../types/invoice';

export const loadInvoiceDetails = async (invoice: Invoice): Promise<Invoice> => {
  if (invoice.attachmentsLoaded !== false) return invoice;
  const response = await getApi().getAllInvoices(undefined, undefined, { id: invoice.id });
  const full = response.data?.[0];
  if (!response.success || response.data?.length !== 1 || full?.id !== invoice.id || full.attachmentsLoaded === false)
    throw new Error('Could not load the complete invoice. It may have been removed. Please retry.');
  return full;
};
