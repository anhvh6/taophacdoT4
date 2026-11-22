import { integrationHandler } from '../integrations/http.js';

export default function handler(req: Parameters<typeof integrationHandler>[0], res: Parameters<typeof integrationHandler>[1]) {
  const route = typeof req.query.mp_route === 'string' ? req.query.mp_route : '';
  if (route === '@mcp') return integrationHandler(req,res,'','mcp');
  if (route === '@webhook') return integrationHandler(req,res,'','webhook');
  return integrationHandler(req,res,route);
}
