import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRUDPage } from '../shared/components/layout/crudPage/CRUDPage';
import type { Response } from '../shared/types/response';

interface Row {
  id: number;
  name: string;
}
interface BarProps {
  isOpen: boolean;
  isModal: boolean;
  handleSave: (data: unknown) => Promise<void>;
  renderForm: (args: { onChange: () => void }) => ReactNode;
}
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
  bar: undefined as unknown,
  onDone: undefined as unknown
}));
vi.mock('../state/configureStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../shared/hooks/persistent/usePersistentFilters', () => ({
  usePersistentFilters: (value: unknown) => useState(value)
}));
vi.mock('../shared/hooks/persistent/usePersistentSearch', () => ({
  usePersistentSearch: (value: unknown) => useState(value)
}));
vi.mock('../shared/hooks/persistent/usePersistentSort', () => ({
  usePersistentSort: (value: unknown) => useState(value)
}));
vi.mock('../shared/components/layout/pageAppBar/PageAppBar', () => ({
  PageAppBar: (props: BarProps) => {
    mocks.bar = props;
    return props.isOpen || !props.isModal ? (
      <div data-testid="editor">{props.renderForm({ onChange: () => {} })}</div>
    ) : null;
  }
}));
vi.mock('../shared/components/layout/content/Content', () => ({
  Content: ({ node }: { node: ReactNode }) => <div>{node}</div>
}));
vi.mock('../shared/components/controls/filterSortBar/FilterSortBar', () => ({ FilterSortBar: () => null }));
vi.mock('../shared/components/inputs/searchInput/SearchInput', () => ({ SearchInput: () => null }));
vi.mock('../shared/components/modals/bottomFilterSheet/BottomFilterSheet', () => ({ BottomFilterSheet: () => null }));
vi.mock('../shared/utils/fileFunctions', () => ({ exportExcel: vi.fn(), importExcel: vi.fn() }));
vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key })
}));
const rows: Row[] = [];
const retrieve = () => ({ items: rows, execute: mocks.reload });
const add = ({ onDone }: { onDone?: (data: Response<Row>) => void }) => {
  mocks.onDone = onDone;
  return { execute: mocks.save };
};
const done = (response: Response<Row>) => act(() => (mocks.onDone as (data: Response<Row>) => void)(response));
const bar = () => mocks.bar as BarProps;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CRUD invoice save lifecycle', () => {
  it.each([true, false])('only clears the form and navigation warning after success=%s', async success => {
    render(
      <CRUDPage<Row, Omit<Row, 'id'>, Row>
        componentId="save-test"
        searchField="name"
        noItemText="Empty"
        sortOptions={[{ label: 'Name', value: 'name' }]}
        useRetrieve={retrieve}
        useAdd={add}
        validateAndNormalize={async data => data as Omit<Row, 'id'>}
        form={() => <span>Draft invoice</span>}
      />
    );
    const addButton = screen.getByRole('button', { name: 'ariaLabel.add' });
    act(() => addButton.click());
    expect(screen.queryAllByTestId('editor').length).toBeGreaterThan(0);
    await act(() => bar().handleSave({ name: 'draft' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    // The draft remains visible until the server accepts the save.
    expect(screen.queryAllByTestId('editor').length).toBeGreaterThan(0);
    mocks.dispatch.mockClear();
    done({ success, data: success ? { id: 1, name: 'draft' } : undefined });
    if (success) {
      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pageSlice/setAllowed', payload: true })
      );
      expect(mocks.reload).toHaveBeenCalled();
    } else {
      expect(screen.queryAllByTestId('editor').length).toBeGreaterThan(0);
      expect(mocks.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pageSlice/setAllowed', payload: true })
      );
      expect(mocks.reload).not.toHaveBeenCalled();
    }
  });
});
