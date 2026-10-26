import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Box, Button, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { store } from '../../src/renderer/state/configureStore';
import { setSettings } from '../../src/renderer/state/pageSlice';
import { invoice, settings } from '../../src/renderer/__tests__/billingPeriodFixtures';
import { GenericList } from '../../src/renderer/shared/components/lists/genericList/GenericList';
import { List } from '../../src/renderer/pages/invoices/List';
import { darkTheme, lightTheme } from '../../src/renderer/shared/components/layout/theme/theme';
import { FilterType } from '../../src/renderer/shared/enums/filterType';
import type { Invoice } from '../../src/renderer/shared/types/invoice';
import '../../src/renderer/i18n';

window.electronAPI = {
  getAppVersion: async () => 'test',
  onUpdateAvailable: () => () => {},
  onUpdateNotAvailable: () => () => {},
  onUpdateProgress: () => () => {},
  onUpdateDownloaded: () => () => {}
} as unknown as typeof window.electronAPI;
const { AppLayout } = await import('../../src/renderer/app/AppLayout');
const { CRUDPage } = await import('../../src/renderer/shared/components/layout/crudPage/CRUDPage');
const query = new URLSearchParams(location.search);
const catalog = query.has('catalog');
const rows = Array.from({ length: 18 }, (_, index) => invoice(index + 1));
const retrieve = () => ({ items: rows, execute: () => {} });
store.dispatch(setSettings({ ...settings, quotesON: true, styleProfilesON: true, reportsON: true }));
const FixturePage = () => (
  <CRUDPage<Invoice, Invoice, Invoice>
    componentId="invoice-layout"
    title="Invoice"
    leftTitle="Invoices"
    noItemText="Select an invoice"
    inlineOnAdd
    listActions={<Button variant="outlined">Billing period / payments</Button>}
    useRetrieve={retrieve}
    searchField="invoiceNumber"
    sortOptions={[
      { label: 'Issued at', value: 'issuedAt' },
      { label: 'Invoice number', value: 'invoiceNumber' }
    ]}
    filters={[{ type: FilterType.all, value: FilterType.all, label: 'All', initial: true }]}
    renderListItem={(item, selected, onEdit) =>
      catalog ? (
        <GenericList
          key={item.id}
          item={{ id: item.id! }}
          getName={() => 'Example catalog item'}
          getEmail={() => 'example@example.com'}
          onEdit={() => onEdit(item)}
          onDelete={() => {}}
        />
      ) : (
        <List key={item.id} item={item} isSelected={selected?.id === item.id} onEdit={onEdit} />
      )
    }
    form={() => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <Typography key={i}>Invoice details {i + 1}</Typography>
        ))}
      </Box>
    )}
  />
);
createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={['/invoices']}>
      <ThemeProvider theme={query.get('theme') === 'light' ? lightTheme : darkTheme}>
        <CssBaseline />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/invoices" element={<FixturePage />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  </Provider>
);
