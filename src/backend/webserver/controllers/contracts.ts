import type { Express } from 'express';
import * as service from '../../shared/services/contracts';
import { dbInstance } from '../database';
import { requireDB } from '../utils/functions';

export const initContractsController = (app: Express) => {
  app.get('/api/contract-terms-template', requireDB, async (_req, res) =>
    res.json(await service.getContractTermsTemplate(dbInstance!))
  );
  app.put('/api/contract-terms-template', requireDB, async (req, res) =>
    res.json(await service.saveContractTermsTemplate(dbInstance!, req.body))
  );
  app.get('/api/contracts', requireDB, async (req, res) =>
    res.json(
      await service.listContracts(
        dbInstance!,
        req.query.clientId === undefined ? undefined : Number(req.query.clientId)
      )
    )
  );
  app.get('/api/contracts/:id', requireDB, async (req, res) =>
    res.json(await service.getContract(dbInstance!, Number(req.params.id)))
  );
  app.post('/api/contracts', requireDB, async (req, res) =>
    res.json(await service.saveContract(dbInstance!, req.body))
  );
};
