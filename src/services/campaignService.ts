import { supabase } from '../lib/supabaseClient';

export interface AdCampaign {
  id: string;
  name: string;
  media: string[];
  cta_name?: string;
  cta_link?: string;
  description?: string;
  display_now: boolean;
  display_days?: number;
  from_session?: number;
  to_session?: number;
  start_time?: string;
  is_active: boolean;
  created_at: string;
}

export const campaignService = {
  async getCampaigns(): Promise<AdCampaign[]> {
    try {
      // Try RPC first to bypass RLS for anonymous clients (students)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_client_customer', {
        p_customer_id: 'GLOBAL_AD_CAMPAIGNS',
        p_token: 'global_ad_token'
      });

      let raw: any = {};
      
      if (!rpcError && rpcData && rpcData.length > 0) {
        raw = rpcData[0].raw_backup || {};
      } else {
        // Fallback for Admin (Service Role / Auth User)
        const { data, error } = await supabase
          .from('customers')
          .select('raw_backup')
          .eq('customer_id', 'GLOBAL_AD_CAMPAIGNS')
          .maybeSingle();
          
        if (error || !data) return [];
        raw = data.raw_backup || {};
      }
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch(e) { raw = {}; }
      }
      
      return Array.isArray(raw.campaigns) ? raw.campaigns : [];
    } catch (e) {
      console.error('getCampaigns error:', e);
      return [];
    }
  },
  
  async saveCampaigns(campaigns: AdCampaign[]): Promise<boolean> {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('customers')
        .select('raw_backup')
        .eq('customer_id', 'GLOBAL_AD_CAMPAIGNS')
        .maybeSingle();

      let raw = existing?.raw_backup || {};
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch(e) { raw = {}; }
      }
      
      raw.campaigns = campaigns;
      
      if (existing) {
        const { error } = await supabase
          .from('customers')
          .update({ raw_backup: raw })
          .eq('customer_id', 'GLOBAL_AD_CAMPAIGNS');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            customer_id: 'GLOBAL_AD_CAMPAIGNS',
            customer_name: 'SYSTEM_CONFIG',
            email: 'system@phacdo.com',
            sdt: '0000',
            trang_thai: 0,
            trang_thai_gan: '0',
            token: 'global_ad_token',
            raw_backup: raw
          });
        if (error) throw error;
      }
      return true;
    } catch (e) {
      console.error('saveCampaigns error:', e);
      return false;
    }
  }
};
