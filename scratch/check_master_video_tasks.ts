import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('master_video_tasks').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(data);
  }
}

run();
