import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePreviewInvoice } from '../shared/hooks/pdf/usePreviewInvoice';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('coalesces typing but switches invoice identity immediately', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ id, customerNotes }) => usePreviewInvoice({ id, customerNotes }), {
    initialProps: { id: 1, customerNotes: 'original' }
  });
  rerender({ id: 1, customerNotes: 'first edit' });
  act(() => vi.advanceTimersByTime(100));
  rerender({ id: 1, customerNotes: 'latest edit' });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.customerNotes).toBe('original');
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.customerNotes).toBe('latest edit');
  rerender({ id: 2, customerNotes: 'other invoice' });
  expect(result.current?.id).toBe(2);
});
