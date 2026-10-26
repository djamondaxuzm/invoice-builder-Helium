import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { Box, Button, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { store } from '../../src/renderer/state/configureStore';
import { setSettings } from '../../src/renderer/state/pageSlice';
import { invoice, settings } from '../../src/renderer/__tests__/billingPeriodFixtures';
import { CRUDPage } from '../../src/renderer/shared/components/layout/crudPage/CRUDPage';
import { GenericList } from '../../src/renderer/shared/components/lists/genericList/GenericList';
import { List } from '../../src/renderer/pages/invoices/List';
import { FilterType } from '../../src/renderer/shared/enums/filterType';
import type { Invoice } from '../../src/renderer/shared/types/invoice';
import '../../src/renderer/i18n';

const catalog = new URLSearchParams(location.search).has('catalog');
const rows = Array.from({ length: 18 }, (_, index) => invoice(index + 1));
const retrieve = () => ({ items: rows, execute: () => {} });
store.dispatch(setSettings(settings));
createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <MemoryRouter>
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <CssBaseline />
        <Box sx={{ height: '100vh', p: 2 }}>
          <CRUDPage<Invoice, Invoice, Invoice>
            componentId="invoice-layout"
            leftTitle="Invoices"
            noItemText="Select an invoice"
            listActions={<Button variant="outlined">Billing period / payments</Button>}
            useRetrieve={retrieve}
            searchField="invoiceNumber"
            sortOptions={[
              { label: 'Issued at', value: 'issuedAt' },
              { label: 'Invoice number', value: 'invoiceNumber' }
            ]}
            filters={[{ type: FilterType.all, value: FilterType.all, label: 'All', initial: true }]}
            renderListItem={item =>
              catalog ? (
                <GenericList
                  key={item.id}
                  item={{ id: item.id! }}
                  getName={() => 'Example catalog item'}
                  getEmail={() => 'example@example.com'}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ) : (
                <List key={item.id} item={item} isSelected={false} onEdit={() => {}} />
              )
            }
          />
        </Box>
      </ThemeProvider>
    </MemoryRouter>
  </Provider>
);
