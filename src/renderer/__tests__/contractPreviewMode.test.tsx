import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newContractDraft } from '../../backend/shared/utils/contracts';
import type { SavedContract } from '../../backend/shared/types/contracts';
import { ContractsPage } from '../pages/contracts';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock('../state/configureStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../shared/api/restApi', () => ({
  getApi: () => ({
    listContracts: async () => ({
      success: true,
      data: [
        { id: 1, title: 'Saved project', date: '2026-11-08', clientName: 'Example client', clientId: 1, revision: 1 }
      ]
    }),
    getAllClients: async () => ({ success: true, data: [] }),
    getAllBusinesses: async () => ({ success: true, data: [] }),
    getAllItems: async () => ({ success: true, data: [] }),
    getAllStyleProfiles: async () => ({ success: true, data: [] }),
    getContract: mocks.get,
    saveContract: mocks.save
  })
}));

let record: SavedContract;
beforeEach(() => {
  record = {
    id: 1,
    revision: 1,
    title: 'Saved project',
    date: '2026-11-08',
    clientName: 'Example client',
    clientId: 1,
    signed: false,
    updatedAt: '2026-11-08T12:00:00Z',
    draft: {
      ...newContractDraft('2026-11-08'),
      title: 'Saved project',
      client: { sourceId: 1, name: 'Example client', address: '', email: '', phone: '' },
      business: { sourceId: 2, name: 'Example business', address: '', email: '', phone: '' },
      rates: [{ sourceId: 3, name: 'Labor', hourlyRate: '85' }],
      assessmentRate: { sourceId: 3, name: 'Labor', hourlyRate: '85' }
    }
  };
  mocks.get.mockResolvedValue({ success: true, data: record });
  mocks.save.mockResolvedValue({ success: false, message: 'Save failed. Try again.' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('keeps unsaved fields, the current step and navigation protection when switching preview and back', async () => {
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open contract' }));
  const title = await screen.findByLabelText('Project title');
  fireEvent.change(title, { target: { value: 'Updated project' } });
  fireEvent.click(screen.getByRole('tab', { name: /Terms/ }));
  const terms = screen.getByLabelText('Additional charges / project terms');
  fireEvent.change(terms, { target: { value: 'Keep this unsaved note.' } });
  fireEvent.click(screen.getByRole('button', { name: 'ariaLabel.preview' }));
  const preview = screen.getByRole('region', { name: 'Contract document preview' });
  expect(preview).toHaveTextContent('Updated project');
  expect(preview).toHaveTextContent('Keep this unsaved note.');
  expect(terms).not.toBeVisible();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ payload: false }));
  fireEvent.click(screen.getByRole('button', { name: 'ariaLabel.edit' }));
  expect(terms).toBeVisible();
  expect(terms).toHaveValue('Keep this unsaved note.');
  expect(screen.queryByRole('region', { name: 'Contract document preview' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Client & project/ }));
  expect(screen.getByLabelText('Project title')).toHaveValue('Updated project');
});

it('keeps a failed save editable from preview without clearing the draft', async () => {
  render(<ContractsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open contract' }));
  fireEvent.change(await screen.findByLabelText('Project title'), { target: { value: 'Retry this draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'ariaLabel.preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        revision: 1,
        draft: expect.objectContaining({ title: 'Retry this draft' })
      })
    )
  );
  expect(await screen.findByText('Save failed. Try again.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'ariaLabel.edit' }));
  expect(screen.getByLabelText('Project title')).toHaveValue('Retry this draft');
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
});
