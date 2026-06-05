import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.vercel');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  console.log('Applying authorize_device fix to Supabase...');

  const sql = `
    drop function if exists authorize_device(text, text, text, text);
    
    create or replace function authorize_device(p_customer_id text, p_token text, p_device_id text, p_device_name text)
    returns json security definer
    set search_path = public
    as $$
    declare
      v_count integer;
      v_is_approved boolean;
      v_require_limit boolean;
    begin
      -- Check customer
      select require_device_limit into v_require_limit
      from customers where customer_id = p_customer_id and token = p_token;
      
      if not found then
        return json_build_object('success', false, 'message', 'Unauthorized');
      end if;

      if v_require_limit = false then
        return json_build_object('success', true, 'message', 'Limit disabled');
      end if;

      -- Check if device already exists
      select is_approved into v_is_approved
      from customer_devices where customer_id = p_customer_id and device_id = p_device_id;

      if found then
        if v_is_approved then
            return json_build_object('success', true, 'message', 'Already approved');
        else
            -- If found but pending, check if we can auto-approve now (if approved count < 2)
            select count(*) into v_count from customer_devices where customer_id = p_customer_id and is_approved = true;
            if v_count < 2 then
                update customer_devices 
                set is_approved = true, approved_at = now(), last_used_at = now()
                where customer_id = p_customer_id and device_id = p_device_id;
                return json_build_object('success', true, 'message', 'Auto approved');
            else
                return json_build_object('success', false, 'message', 'Pending approval');
            end if;
        end if;
      end if;

      -- New device, check approved count only
      select count(*) into v_count from customer_devices where customer_id = p_customer_id and is_approved = true;

      if v_count < 2 then
        -- Auto approve new device
        insert into customer_devices (customer_id, device_id, device_name, is_approved, approved_at)
        values (p_customer_id, p_device_id, p_device_name, true, now())
        on conflict (customer_id, device_id) do update set is_approved = true, approved_at = now();
        return json_build_object('success', true, 'message', 'Auto approved');
      else
        -- Block and wait for admin
        return json_build_object('success', false, 'message', 'Device limit reached');
      end if;
    end;
    $$ language plpgsql;

    grant execute on function authorize_device(text, text, text, text) to anon, authenticated;
  `;

  const { error } = await supabase.rpc('admin_run_sql', { sql_query: sql });
  
  if (error) {
    console.error('Error applying fix via admin_run_sql:', error);
    process.exit(1);
  } else {
    console.log('authorize_device fix applied successfully!');
  }
}

applyFix();
