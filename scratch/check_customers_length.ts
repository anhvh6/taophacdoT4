import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('customers').select('*');
  console.log('Error:', error);
  console.log('Length:', data?.length);
  if (data && data.length > 0) {
    console.log(data[0].customer_name, data[0].video_date);
  }
}

run();
