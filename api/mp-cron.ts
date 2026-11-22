import { checkSecret, failure, integrationDb, IntegrationError } from '../integrations/core.js';
import { posWorker } from '../integrations/pancake.js';
import { scheduledDueOrderPoll } from '../integrations/scheduler.js';

export default async function handler(req:{method?:string;headers:Record<string,string|string[]|undefined>},
  res:{setHeader(name:string,value:string):unknown;status(code:number):{json(value:unknown):unknown}}) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method!=='GET') throw new IntegrationError(405,'METHOD_NOT_ALLOWED','Cron accepts GET.');
    if (process.env.MP_PHASE2_FOUNDATION_ENABLED!=='true') throw new IntegrationError(503,'DISABLED','Foundation worker disabled.');
    const auth=req.headers.authorization;
    if (!process.env.CRON_SECRET || typeof auth!=='string' || !auth.startsWith('Bearer ') || !checkSecret(auth.slice(7),process.env.CRON_SECRET)) {
      throw new IntegrationError(401,'UNAUTHORIZED','Scheduler authentication required.');
    }
    const db=integrationDb();
    const poll=await scheduledDueOrderPoll(db);
    const totals={applied:0,stale:0,failed:0};
    for (let batch=0;batch<4;batch++) {
      const result=await posWorker(db) as typeof totals;
      for (const field of ['applied','stale','failed'] as const) totals[field]+=result[field];
      if (result.applied+result.stale+result.failed<50) break;
    }
    return res.status(200).json({success:true,data:{...totals,...(poll?{poll}:{})}});
  } catch(error) {
    const e=failure(error);
    return res.status(e.status).json({success:false,error:{code:e.code,message:e.message}});
  }
}
