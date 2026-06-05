import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('customers').select('customer_id, customer_name, video_date').limit(10);
  if (error) {
    console.error('Error:', error);
  } else {
    data.forEach(c => console.log(c));
  }
}

run();
