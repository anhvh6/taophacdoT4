import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.rpc('get_schema_info', { table_name: 'master_video_tasks' });
  if (error) {
    console.error('Error with RPC:', error);
    // Let's try querying information_schema directly using a raw query or we can just query a single row and see headers, but there's no data.
    // We can also insert a dummy row and read it, or check the TS types!
  } else {
    console.log(data);
  }
}

run();
