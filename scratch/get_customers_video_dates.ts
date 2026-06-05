import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    data.slice(0, 5).forEach(c => console.log(c.customer_name, c.video_date));
  }
}

run();
