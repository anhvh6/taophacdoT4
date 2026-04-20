import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  const id = String(req.query?.id || '').trim();
  const t = String(req.query?.t || '').trim();

  if (!id || !t) {
    return res.status(400).json({ error: 'Missing id or token' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server env is not configured' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('customers')
      .select('require_google_auth, require_device_limit')
      .eq('customer_id', id)
      .eq('token', t)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      require_google_auth: data.require_google_auth,
      require_device_limit: data.require_device_limit
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
