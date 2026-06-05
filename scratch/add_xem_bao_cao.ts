import { supabase } from '../src/lib/supabaseClient';

async function run() {
  const { data, error } = await supabase
    .from('permissions')
    .insert({ code: 'xem_bao_cao', display_name: 'xem báo cáo' })
    .select();

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Inserted:', data);
  }

  // Auto assign to super_admin
  const { data: roleData, error: roleError } = await supabase
    .from('role_permissions')
    .insert({ role_name: 'super_admin', permission_code: 'xem_bao_cao' });
    
  if (roleError) {
    console.error('Error assigning to super_admin:', roleError);
  } else {
    console.log('Assigned to super_admin');
  }
}

run();
