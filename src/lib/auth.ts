import { supabase } from './supabaseClient';

export const auth = {
  signIn: async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  },
  signOut: async () => {
    return supabase.auth.signOut();
  },
  getSession: async () => {
    return supabase.auth.getSession();
  },
  onAuthStateChange: (callback: (session: any) => void) => {
    return supabase.auth.onAuthStateChange((_event, session) => callback(session));
  },
  isAdmin: async (userId: string) => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error("isAdmin query error:", error);
      return false;
    }
    return !!data;
  },
  getAdminRole: async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error("getAdminRole query error:", error);
      return null;
    }
    return data?.role || null;
  }
};
