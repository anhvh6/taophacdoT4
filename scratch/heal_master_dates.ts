import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function heal() {
  const shifts = [
    { from: '2026-05-15', to: '2026-05-16' },
    { from: '2026-04-15', to: '2026-04-16' },
    { from: '2026-03-15', to: '2026-03-16' },
    { from: '2025-12-27', to: '2025-12-28' },
    { from: '2025-12-28', to: '2025-12-29' },
    { from: '2026-02-19', to: '2026-02-20' },
    { from: '2026-02-20', to: '2026-02-21' },
    { from: '2026-03-18', to: '2026-03-19' },
    { from: '2026-03-19', to: '2026-03-20' }
  ];

  for (const shift of shifts) {
    const { data, error } = await supabase
      .from('master_video_tasks')
      .update({ video_date: shift.to })
      .eq('video_date', shift.from);

    if (error) {
      console.error(`Failed to shift ${shift.from} to ${shift.to}`, error);
    } else {
      console.log(`Shifted ${shift.from} to ${shift.to}`);
    }
  }
}

heal();
