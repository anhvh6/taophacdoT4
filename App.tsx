import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './pages/Dashboard';
import { CustomerManagement } from './pages/CustomerManagement';
import { PlanEditor } from './pages/PlanEditor';
import { ProductManagement } from './pages/ProductManagement';
import { ClientView } from './pages/ClientView';
import { VideoGroupManagement } from './pages/VideoGroupManagement';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import { MigrationTool } from './src/pages/MigrationTool';
import { customerService } from './src/services/customerService';
import { productService } from './src/services/productService';
import { auth } from './src/lib/auth';
import { AlertCircle, RefreshCw, ShieldAlert, LogIn, Database } from 'lucide-react';
import { Button, Toast } from './components/UI';

import { Customer, Product, CustomerStatus } from './types';

type Page = 'dashboard' | 'management' | 'plan-editor' | 'products' | 'preview' | 'video-groups' | 'login' | 'migrate' | 'analytics';

const APP_MODE = import.meta.env.VITE_APP_MODE || 'admin';

const App: React.FC = () => {
  const getInitialPage = (): Page => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    
    if (pathname.startsWith('/client/')) return 'preview';
    
    const [path] = hash.split('?');
    if (path.startsWith('#/client/')) return 'preview';
    if (path === '#/login') return 'login';
    if (path === '#/plan-editor') return 'plan-editor';
    if (path === '#/management') return 'management';
    if (path === '#/products') return 'products';
    if (path === '#/video-groups') return 'video-groups';
    if (path === '#/analytics') return 'analytics';
    if (path === '#/migrate') return 'migrate';
    if (path === '#/add-student') return 'dashboard';
    return 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage());
  const [pageParams, setPageParams] = useState<any>(() => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    const search = window.location.search;
    
    // Handle Pathname routing (SEO friendly)
    if (pathname.startsWith('/client/')) {
      const searchParams = new URLSearchParams(search);
      return { customerId: pathname.replace('/client/', ''), token: searchParams.get('t') || undefined };
    }

    // Handle Hash routing (Legacy)
    const [path, query] = hash.split('?');
    const searchParams = new URLSearchParams(query);
    if (path.startsWith('#/client/')) {
      return { customerId: path.replace('#/client/', ''), token: searchParams.get('t') || undefined };
    }
    if (path === '#/plan-editor') {
      return { 
        customerId: searchParams.get('id') || undefined, 
        templateId: searchParams.get('template') || undefined,
        returnTo: searchParams.get('returnTo') || undefined
      };
    }
    if (path === '#/management') {
      return { customerId: searchParams.get('id') || undefined };
    }
    if (path === '#/add-student') {
      return { action: 'add' };
    }
    return {};
  });
  
  // Auth State
  const [session, setSession] = useState<any>({ user: { id: 'mock-admin' } }); // MOCK: Auto bypassed login
  const [isAdmin, setIsAdmin] = useState(true); // MOCK: Always admin
  const [authLoading, setAuthLoading] = useState(false); // MOCK: Don't wait for auth
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Centralized State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftCustomer, setDraftCustomer] = useState<Partial<Customer> | undefined>(() => {
    const saved = sessionStorage.getItem('mega_draft_customer');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return undefined; }
    }
    return undefined;
  });

  const lastMutationTime = useRef<number>(0);
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  // Auth Initialization
  useEffect(() => {
    // MOCK: Bypassing auth checks locally
    /*
    const initAuth = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        setSession(session);
        if (session) {
          auth.isAdmin(session.user.id).then(setIsAdmin);
        }
      } catch (e) {
        console.error("Auth init failed:", e);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = auth.onAuthStateChange((session) => {
      setSession(session);
      if (session) {
        auth.isAdmin(session.user.id).then(setIsAdmin);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
    */
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const { data, error } = await auth.signIn(loginEmail, loginPassword);
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        const admin = await auth.isAdmin(data.session.user.id);
        setIsAdmin(admin);
        if (!admin) {
          await auth.signOut();
          throw new Error('Bạn không có quyền truy cập trang quản trị');
        }
        window.location.hash = '#/dashboard';
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || 'Đăng nhập thất bại');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setSession(null);
    setIsAdmin(false);
    window.location.hash = '#/login';
  };

  // Load initial data from cache and server
  const refreshData = async (force = false) => {
    // Only fetch if authenticated for admin pages
    if (!session && !window.location.hash.startsWith('#/client/')) {
      setLoading(false);
      return;
    }

    // Optimization: Only fetch all customers if on a page that needs them
    const needsAllCustomers = ['dashboard', 'management'].includes(currentPage);
    if (!needsAllCustomers && !force) {
      setLoading(false);
      return;
    }

    if (!force) {
      const cachedCust = localStorage.getItem('mega_customers_cache');
      const cachedProd = localStorage.getItem('mega_products_cache');
      if (cachedCust && cachedProd) {
        try {
          setCustomers(JSON.parse(cachedCust));
          setProducts(JSON.parse(cachedProd));
          setLoading(false);
        } catch (e) {}
      }
    }

    try {
      setError(null);
      
      const [cust, prod] = await Promise.all([customerService.getCustomers(), productService.getProducts()]);
      
      if (Date.now() - lastMutationTime.current < 10000 && !force) {
        return;
      }

      // Deduplicate customers by ID just in case
      const validCust = Array.isArray(cust) ? cust : [];
      const uniqueCustMap = new Map();
      validCust.forEach(c => {
        if (c.customer_id && !uniqueCustMap.has(c.customer_id)) {
          uniqueCustMap.set(c.customer_id, c);
        }
      });
      const uniqueCust = Array.from(uniqueCustMap.values());
      
      const validProd = Array.isArray(prod) ? prod : [];
      
      setCustomers(uniqueCust);
      setProducts(validProd);
      
      try {
        localStorage.removeItem('mega_customers_cache');
        localStorage.removeItem('mega_products_cache');
      } catch (e) {}
    } catch (e: any) {
      console.error("Failed to fetch data:", e);
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session || currentPage === 'migrate') refreshData();
  }, [session, currentPage]);

  const handleUpsertCustomer = async (payload: Partial<Customer>, tasks?: any) => {
    // if (!session) throw new Error('Unauthorized'); // MOCK: Bypassed
    lastMutationTime.current = Date.now();
    const existingIdx = customers.findIndex(c => c.customer_id === payload.customer_id);
    const isNew = existingIdx === -1;
    
    try {
      const result = await customerService.upsertCustomer(payload, tasks);
      setCustomers(prev => {
        const existingIdx = prev.findIndex(c => c.customer_id === result.customer_id);
        let next;
        
        if (existingIdx !== -1) {
          // Update existing
          next = [...prev];
          next[existingIdx] = result;
        } else {
          // Prepend new
          next = [result, ...prev];
        }
        
        // Optimization: Defer localStorage update to avoid blocking the main thread
        setTimeout(() => {
          try {
            localStorage.setItem('mega_customers_cache', JSON.stringify(next));
          } catch(e) {
            console.warn("QuotaExceededError in App.tsx cache", e);
          }
        }, 0);
        
        return next;
      });
      return result;
    } catch (e) {
      console.error("Upsert failed:", e);
      refreshData(true);
      throw e;
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    // if (!session) throw new Error('Unauthorized'); // MOCK: Bypassed
    lastMutationTime.current = Date.now();
    setCustomers(prev => {
      const next = prev.filter(c => c.customer_id !== id);
      localStorage.setItem('mega_customers_cache', JSON.stringify(next));
      return next;
    });

    try {
      await customerService.deleteCustomer(id);
    } catch (e) {
      console.error("Delete failed:", e);
      refreshData(true);
      throw e;
    }
  };

  // Routing Logic
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const hostname = window.location.hostname;
      
      // Redirect root domain to main site as requested
      // Only redirect if the hostname is exactly phacdo.vercel.app or phacdo.netlify.app
      // This prevents redirecting admin subdomains like taophacdo.vercel.app
      const isTargetDomain = hostname === 'phacdo.vercel.app' || hostname === 'phacdo.netlify.app' || hostname.endsWith('.phacdo.vercel.app') || hostname.endsWith('.phacdo.netlify.app');
      const pathname = window.location.pathname;
      const isRootPath = (!hash || hash === '' || hash === '#' || hash === '#/') && (pathname === '/' || pathname === '');
      
      // CRITICAL: Never redirect if we are on a client preview path
      if (hash.startsWith('#/client/') || pathname.startsWith('/client/')) {
        const [path, query] = hash.split('?');
        const search = window.location.search;
        const searchParams = new URLSearchParams(query || search);
        
        let idPart = '';
        let token = searchParams.get('t') || undefined;

        if (pathname.startsWith('/client/')) {
          idPart = pathname.replace('/client/', '');
        } else {
          idPart = path.replace('#/client/', '');
        }

        setCurrentPage('preview');
        setPageParams({ customerId: idPart, token });
        return;
      }

      if (isTargetDomain && isRootPath) {
        window.location.replace('https://30ngaythaydoi.vercel.app/');
        return;
      }

      const [path, query] = hash.split('?');
      const searchParams = new URLSearchParams(query);

      if (path !== '#/plan-editor') {
        sessionStorage.removeItem('mega_draft_customer');
        setDraftCustomer(undefined);
      }

      if (path === '#/login') {
        setCurrentPage('login');
      } else if (path === '#/plan-editor') {
        setCurrentPage('plan-editor');
        setPageParams({ 
          customerId: searchParams.get('id') || undefined,
          templateId: searchParams.get('template') || undefined,
          returnTo: searchParams.get('returnTo') || undefined
        });
      } else if (path === '#/management') {
        setCurrentPage('management');
        setPageParams({
          customerId: searchParams.get('id') || undefined
        });
      } else if (path === '#/products') {
        setCurrentPage('products');
        setPageParams({});
      } else if (path === '#/video-groups') {
        setCurrentPage('video-groups');
        setPageParams({});
      } else if (path === '#/analytics') {
        setCurrentPage('analytics');
        setPageParams({});
      } else if (path === '#/migrate') {
        setCurrentPage('migrate');
        setPageParams({});
      } else if (path === '#/add-student') {
        setCurrentPage('dashboard');
        setPageParams({ action: 'add' });
      } else if (path === '#/dashboard' || path === '' || path === '#/') {
        setCurrentPage('dashboard');
        setPageParams({});
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Redirect to login if not authenticated for admin pages
  useEffect(() => {
    if (APP_MODE === 'client') return;
    if (!authLoading && !session && currentPage !== 'preview' && currentPage !== 'login' && currentPage !== 'migrate') {
      window.location.hash = '#/login';
    }
  }, [session, authLoading, currentPage]);

  // Update page title
  useEffect(() => {
    if (currentPage !== 'preview') {
      document.title = "Mega Phương Admin";
    }
  }, [currentPage]);

  const navigate = (page: string, params?: any) => {
    let newHash = `#/${page}`;
    
    if (params?.toast) {
      setGlobalToast(params.toast);
    }

    if (params?.draftCustomer) {
      sessionStorage.setItem('mega_draft_customer', JSON.stringify(params.draftCustomer));
      setDraftCustomer(params.draftCustomer);
    } else {
      sessionStorage.removeItem('mega_draft_customer');
      setDraftCustomer(undefined);
    }
    
    if (page === 'preview' && params?.customerId) {
      newHash = `#/client/${params.customerId}?preview=true`;
      if (params.token) newHash += `&t=${params.token}`;
    } else if (params) {
      const searchParams = new URLSearchParams();
      if (params.customerId) searchParams.set('id', params.customerId);
      if (params.templateId) searchParams.set('template', params.templateId);
      if (params.token) searchParams.set('t', params.token);
      if (params.returnTo) searchParams.set('returnTo', params.returnTo);
      
      const qs = searchParams.toString();
      if (qs) newHash += `?${qs}`;
    }
    
    window.location.hash = newHash;
  };

  // Redirect to https://30ngaythaydoi.vercel.app/ if in client mode and not on a preview page
  useEffect(() => {
    if (APP_MODE === 'client' && currentPage !== 'preview') {
      window.location.replace('https://30ngaythaydoi.vercel.app/');
    }
  }, [currentPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }



  if (currentPage === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-700 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <ShieldAlert className="w-10 h-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Mega Phương Admin</h1>
          <p className="text-center text-gray-500 mb-8">Vui lòng đăng nhập để quản lý hệ thống</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer">Ghi nhớ đăng nhập</label>
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentPage === 'preview') {
    const isPreviewContext = window.location.hash.includes('preview=true') || window.location.search.includes('preview=true');
    return <ClientView customerId={pageParams.customerId} token={pageParams.token} onNavigate={APP_MODE === 'admin' && isPreviewContext ? navigate : undefined} />;
  }

  if (APP_MODE === 'client') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-6 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Đang chuyển hướng đến trang chủ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/30">
      {loading && customers.length === 0 && currentPage !== 'migrate' ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw size={48} className="animate-spin text-blue-600" />
          <p className="text-blue-900 font-bold uppercase tracking-widest text-xs">Đang nạp dữ liệu...</p>
        </div>
      ) : (
        <>
          {currentPage === 'dashboard' && (
            <Dashboard 
              onNavigate={navigate} 
              initialAction={pageParams.action} 
              filterStatus={pageParams.filterStatus}
              customers={customers}
              products={products}
              loading={loading}
              onRefresh={() => refreshData(true)}
              onUpsert={handleUpsertCustomer}
              onDelete={handleDeleteCustomer}
              onLogout={handleLogout}
            />
          )}
          {currentPage === 'management' && (
            <CustomerManagement 
              onNavigate={navigate} 
              customerId={pageParams.customerId} 
              customers={customers}
              products={products}
              loading={loading}
              onUpsert={handleUpsertCustomer}
              onDelete={handleDeleteCustomer}
            />
          )}
          {currentPage === 'plan-editor' && (
            <PlanEditor 
              onNavigate={navigate} 
              customerId={pageParams.customerId} 
              templateId={pageParams.templateId} 
              returnTo={pageParams.returnTo}
              draftCustomer={draftCustomer}
              products={products}
              onUpsert={handleUpsertCustomer}
              onDelete={handleDeleteCustomer}
            />
          )}
          {currentPage === 'products' && (
            <ProductManagement onNavigate={navigate} onRefresh={() => refreshData(true)} />
          )}
          {currentPage === 'video-groups' && (
            <VideoGroupManagement onNavigate={navigate} />
          )}
          {currentPage === 'analytics' && (
            <AnalyticsDashboard onNavigate={navigate} customers={customers} products={products} />
          )}
          {currentPage === 'migrate' && (
            <MigrationTool />
          )}
        </>
      )}
      {globalToast && <Toast message={globalToast} onClose={() => setGlobalToast(null)} />}
    </div>
  );
};

export default App;
