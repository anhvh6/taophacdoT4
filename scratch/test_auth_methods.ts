import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

async function run() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const testClient = createClient(supabaseUrl!, supabaseAnonKey!);

  const { auth } = await import('../src/lib/auth');

  console.log("Signing in as anhvh@gmail.com...");
  const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
    email: 'anhvh@gmail.com',
    password: 'anhvh@123'
  });

  if (authError) {
    console.error("Auth failed:", authError);
    return;
  }

  const userId = authData.user.id;
  console.log("Auth succeeded! User ID:", userId);

  // Set the global session for the client used inside auth.ts
  // In a real browser, supabase client holds the session automatically.
  // In Node, we can set it by restoring the session on the auth.ts supabase client.
  // Wait, let's import the supabase client from supabaseClient
  const { supabase } = await import('../src/lib/supabaseClient');
  await supabase.auth.setSession(authData.session);

  console.log("Testing auth.isAdmin...");
  const isAdmin = await auth.isAdmin(userId);
  console.log("isAdmin result:", isAdmin);

  console.log("Testing auth.getAdminRole...");
  const adminRole = await auth.getAdminRole(userId);
  console.log("adminRole result:", adminRole);
}

run();
