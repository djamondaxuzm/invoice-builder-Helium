import { useEffect, useState } from 'react';
import type { InvoiceFromData } from '../../types/invoice';

export const usePreviewInvoice = (invoice?: InvoiceFromData) => {
  const [settled, setSettled] = useState(invoice);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(invoice), 200);
    return () => window.clearTimeout(timer);
  }, [invoice]);
  // Never display another invoice's PDF while waiting for the typing debounce.
  return invoice?.id !== settled?.id ? invoice : settled;
};
