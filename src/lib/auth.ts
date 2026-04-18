export const auth = {
  signIn: async (email: string, password: string) => {
    return { data: { session: { user: { id: 'mock-admin', email } } }, error: null };
  },
  signOut: async () => {
    return { error: null };
  },
  getSession: async () => {
    return { data: { session: { user: { id: 'mock-admin' } } }, error: null };
  },
  onAuthStateChange: (callback: (session: any) => void) => {
    // Return a dummy subscription
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  isAdmin: async (userId: string) => {
    return true;
  }
};
