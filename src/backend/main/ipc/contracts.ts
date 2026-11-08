import { ipcMain } from 'electron';
import * as service from '../../shared/services/contracts';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';
import type { SaveContractRequest, DeleteContractRequest, ContractTermsTemplate } from '../../shared/types/contracts';

export const initContractsHandlers = (db: DatabaseAdapter) => {
  ipcMain.handle('list-contracts', (_event, clientId?: number) => service.listContracts(db, clientId));
  ipcMain.handle('get-contract', (_event, id: number) => service.getContract(db, id));
  ipcMain.handle('save-contract', (_event, request: SaveContractRequest) => service.saveContract(db, request));
  ipcMain.handle('delete-contract', (_event, request: DeleteContractRequest) => service.deleteContract(db, request));
  ipcMain.handle('get-contract-terms-template', () => service.getContractTermsTemplate(db));
  ipcMain.handle('save-contract-terms-template', (_event, request: ContractTermsTemplate) =>
    service.saveContractTermsTemplate(db, request)
  );
};
