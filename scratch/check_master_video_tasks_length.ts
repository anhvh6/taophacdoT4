import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase.from('master_video_tasks').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Length: ${data.length}`);
    if (data.length > 0) {
      console.log(data[0]);
    }
  }
}

run();
