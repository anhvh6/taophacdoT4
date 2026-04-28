import { supabase } from '../src/lib/supabaseClient';

async function testProducts() {
  const prods = [{ id_sp: "SP" + Date.now(), ten_sp: "test", gia_nhap: 100000, gia_ban: 200000, trang_thai: 1 }];
  const { data, error } = await supabase.from('products').upsert(prods, { onConflict: 'id_sp' });
  console.log("Error:", error);
  console.log("Data:", data);
}

testProducts();
