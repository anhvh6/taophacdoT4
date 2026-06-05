import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.rpc('get_triggers');
  if (error) {
    console.error('Error:', error);
    
    // Try querying pg_trigger directly if rpc doesn't exist
    const { data: qData, error: qError } = await supabase.from('pg_trigger').select('*');
    if (qError) {
       console.error('Cannot query pg_trigger directly');
    }
  } else {
    console.log(data);
  }
}

run();
