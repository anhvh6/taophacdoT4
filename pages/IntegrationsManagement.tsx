import React, {useCallback, useEffect, useState} from 'react';
import { auth } from '../src/lib/auth';
import { Button } from '../components/UI';
import { PurchaseAutomation } from '../components/PurchaseAutomation';
import { ReminderBatchReview } from '../components/ReminderBatchReview';

type ScopeDef = {
  scope: string;
  name: string;
  description: string;
  category: 'read' | 'write' | 'admin';
  provider: 'muse' | 'pos';
  endpoints: string[];
};

type KeySummary = {
  id: string;
  label: string;
  key_type: 'user' | 'service';
  lifetime_days: number;
  grace_until: string | null;
  scopes: string[];
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type SyncEvent = {
  id: string;
  pos_id?: string;
  object_type?: string;
  kind: string;
  source: string;
  status: string;
  received_at: string;
  processed_at?: string | null;
  attempts: number;
  last_error: string | null;
};

type PollPage = {
  checked: number;
  queued: number;
  observed_at: string;
  next_page: number | null;
};

type ConnectionSettings = {
  shop_id: string;
  api_key_configured: boolean;
  webhook_secret_configured: boolean;
  muse_origin: string;
  encryption_configured: boolean;
};

type Receipt = {
  id: string;
  received_at: string;
  outcome: string;
  http_status: number;
  error_code: string | null;
  kind: string | null;
  queued: number;
};

type SyncState = {
  last_event: SyncEvent | null;
  last_receipt: Receipt | null;
  events_24h: Record<string, number>;
  rejected_24h: number;
  pending: number;
  dead: number;
  pilot_mode?: boolean;
  pilot_order_id?: string | null;
};

const emptySettings = {
  shop_id: '',
  api_key_configured: false,
  webhook_secret_configured: false,
  muse_origin: '',
  encryption_configured: false
};

async function send(method: string, body?: unknown, path = 'keys') {
  const { data } = await auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
  const response = await fetch('/api/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (payload?.error?.code === 'DISABLED') throw new Error('Máy chủ chưa bật tính năng Kết nối.');
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Không thể thực hiện yêu cầu.');
  return payload.data;
}

export function IntegrationsManagement({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [scopeDefs, setScopeDefs] = useState<ScopeDef[]>([]);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState('');
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editScopes, setEditScopes] = useState<string[]>([]);

  // Webhook and Sync states
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [eventFilterPosId, setEventFilterPosId] = useState('');
  const [eventFilterKind, setEventFilterKind] = useState('');
  const [eventFilterStatus, setEventFilterStatus] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [eventTotalPages, setEventTotalPages] = useState(1);
  const [totalEventEntries, setTotalEventEntries] = useState(0);

  const [scope, setScope] = useState('orders');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [nextPage, setNextPage] = useState<PollPage | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [provider, setProvider] = useState<'pos' | 'muse'>('pos');
  const [settings, setSettings] = useState<ConnectionSettings>(emptySettings);
  const [shop, setShop] = useState('715036491');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [museOrigin, setMuseOrigin] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [keyType, setKeyType] = useState<'user' | 'service'>('service');
  const [keyDays, setKeyDays] = useState(365);
  const [rotateId, setRotateId] = useState('');
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<{ expiring_threshold_days: number; reminder_cooldown_days: number } | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<{enabled:boolean;interval_minutes:number;next_run_at:string|null;consecutive_failures:number;last_error:string|null} | null>(null);

  const refreshKeys = useCallback(async () => {
    try {
      const data = await send('GET', undefined, 'keys');
      setKeys(data || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadScopes = useCallback(async () => {
    try {
      const scopes = await send('GET', undefined, 'admin/scopes');
      setScopeDefs(scopes || []);
    } catch {
      // Fallback if scopes endpoint fails
    }
  }, []);

  const loadWebhookLogs = useCallback(async (p = 1, posId = '', k = '', s = '') => {
    setLogsLoading(true);
    try {
      let query = `admin/sync/logs?page_size=50&page_number=${p}`;
      if (posId) query += `&pos_id=${encodeURIComponent(posId)}`;
      if (k) query += `&object_type=${encodeURIComponent(k)}`;
      if (s) query += `&status=${encodeURIComponent(s)}`;

      const [logData, receiptList, status] = await Promise.all([
        send('GET', undefined, query),
        send('GET', undefined, 'admin/sync/receipts?page_size=50'),
        send('GET', undefined, 'admin/sync/status')
      ]);

      if (logData && typeof logData === 'object' && 'items' in logData) {
        setEvents(logData.items || []);
        setEventPage(logData.page_number || 1);
        setEventTotalPages(logData.total_pages || 1);
        setTotalEventEntries(logData.total_entries || 0);
      } else if (Array.isArray(logData)) {
        setEvents(logData);
        setTotalEventEntries(logData.length);
      }
      setReceipts(receiptList || []);
      setSyncState(status);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không tải được lịch sử webhook.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshKeys(),
      loadScopes(),
      send('GET', undefined, 'admin/connections').then((config: ConnectionSettings) => {
        setSettings(config);
        setShop(config.shop_id || '715036491');
        setMuseOrigin(config.muse_origin);
      }),
      loadWebhookLogs()
    ]).catch(e => setError(e.message));
  }, [refreshKeys, loadScopes, loadWebhookLogs]);

  // Tab switch reload
  const handleTabChange = (newProvider: 'pos' | 'muse') => {
    setProvider(newProvider);
    setLabel('');
    setSelected([]);
    setNewKey('');
    setConfirmLabel('');
    setSettingsMessage('');
    setError('');
    setEditingKeyId(null);
    void refreshKeys();
    if (newProvider === 'pos') {
      void loadWebhookLogs(1, eventFilterPosId, eventFilterKind, eventFilterStatus);
    }
  };

  // Auto-refresh interval (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadWebhookLogs(eventPage, eventFilterPosId, eventFilterKind, eventFilterStatus);
      void refreshKeys();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, eventPage, eventFilterPosId, eventFilterKind, eventFilterStatus, loadWebhookLogs, refreshKeys]);

  async function saveReminderSettings(loadOnly = false) {
    setBusy(true);
    setError('');
    setSettingsMessage('');
    try {
      const path = 'admin/reminders/settings';
      setReminderConfig(await send(loadOnly ? 'GET' : 'PUT', loadOnly ? undefined : reminderConfig, path));
      if (!loadOnly) setSettingsMessage('Đã lưu cấu hình nhắc gia hạn.');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không tải được cấu hình nhắc gia hạn.');
    } finally {
      setBusy(false);
    }
  }

  async function saveConnection(target: 'pancake' | 'muse' | 'test') {
    setError('');
    setSettingsMessage('');
    setBusy(true);
    try {
      if (target === 'test') {
        const result = await send('POST', {}, 'admin/connections/pancake/test');
        setSettingsMessage('Đã kết nối shop ' + result.shop_id + ' và xác minh quyền đọc Pancake POS.');
        return;
      }
      const body = target === 'pancake'
        ? { shop_id: shop.trim(), api_key: apiKey || undefined, webhook_secret: webhookSecret || undefined }
        : { origin: museOrigin.trim() };
      const saved: ConnectionSettings = await send('PUT', body, 'admin/connections/' + target);
      setSettings(saved);
      if (target === 'pancake') {
        setApiKey('');
        setWebhookSecret('');
        setShop(saved.shop_id);
        setNextPage(null);
        setSyncMessage('');
        void loadWebhookLogs();
      } else {
        setMuseOrigin(saved.muse_origin);
      }
      setSettingsMessage('Đã lưu cấu hình.');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không lưu được cấu hình.');
    } finally {
      setBusy(false);
    }
  }

  async function changeKey(method: 'POST' | 'DELETE' | 'PATCH', body: unknown) {
    setBusy(true);
    setError('');
    setNewKey('');
    try {
      const result = await send(method, body);
      if (method === 'POST') {
        setNewKey(result.api_key);
        setLabel('');
        setSelected([]);
        setSettingsMessage('Đã tạo khóa mới thành công.');
      } else if (method === 'PATCH') {
        setEditingKeyId(null);
        setSettingsMessage('Đã cập nhật phạm vi quyền của khóa thành công.');
      } else if (method === 'DELETE') {
        setSettingsMessage('Đã thu hồi khóa.');
      }
      setConfirmLabel('');
      await refreshKeys();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không thể thực hiện yêu cầu.');
    } finally {
      setBusy(false);
    }
  }

  async function configureSchedule(save = false) {
    setBusy(true);
    setError('');
    try {
      const body = save && scheduleConfig ? {enabled:scheduleConfig.enabled,interval_minutes:scheduleConfig.interval_minutes} : undefined;
      const result = await send(save ? 'PUT' : 'GET', body, 'admin/sync/schedule');
      setScheduleConfig(result);
      if (save) setSyncMessage('Đã lưu lịch đồng bộ POS cho đơn hàng, khách hàng và sản phẩm.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đọc được lịch đồng bộ.');
    } finally {
      setBusy(false);
    }
  }

  async function runSync(action: 'run' | 'process' | 'logs' | 'pilot' | 'incremental') {
    setBusy(true);
    setError('');
    try {
      if (action === 'incremental') {
        const result = await send('POST', {scope:'orders',mode:'incremental'}, 'admin/sync/run');
        setSyncMessage(`Đã kiểm tra ${result.checked} đơn, thêm ${result.queued} sự kiện. Mốc đồng bộ ${new Date(result.watermark).toLocaleString('vi-VN')}.`);
      }
      if (action === 'run') {
        const window = scope === 'orders' ? { from: new Date(from).toISOString(), to: new Date(to).toISOString() } : {};
        const result = await send('POST', {
          scope,
          ...window,
          page_number: nextPage?.next_page ?? 1,
          observed_at: nextPage?.observed_at
        }, 'admin/sync/run') as PollPage;
        setNextPage(result.next_page ? result : null);
        setSyncMessage(`Đã kiểm tra ${result.checked} và đưa ${result.queued} mục vào hàng đợi.`);
      }
      if (action === 'process') {
        const result = await send('POST', {}, 'admin/sync/process');
        setSyncMessage(`Đã áp dụng ${result.applied}, bỏ qua ${result.stale}, lỗi ${result.failed}.`);
      }
      if (action === 'pilot') {
        const result = await send('POST', {}, 'admin/sync/pilot');
        setSyncMessage(`Đã đọc đơn thử ${result.order_id}, có ${result.item_count} dòng hàng. Thêm ${result.queued} sự kiện mới vào hàng đợi.`);
      }
      await loadWebhookLogs(1, eventFilterPosId, eventFilterKind, eventFilterStatus);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không thể đồng bộ.');
    } finally {
      setBusy(false);
    }
  }

  async function retryEvent(id: string) {
    setBusy(true);
    setError('');
    try {
      await send('POST', {}, 'admin/sync/events/' + id + '/retry');
      setSettingsMessage('Đã đưa sự kiện vào hàng đợi để thử lại.');
      await loadWebhookLogs(eventPage, eventFilterPosId, eventFilterKind, eventFilterStatus);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không thể thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey(id: string) {
    setBusy(true);
    setError('');
    setNewKey('');
    try {
      const result = await send('POST', {}, 'admin/keys/' + id + '/rotate');
      setNewKey(result.api_key);
      setRotateId('');
      await refreshKeys();
      setSettingsMessage('Đã xoay khóa. Khóa cũ còn hiệu lực đến ' + new Date(result.grace_until).toLocaleString('vi-VN') + '.');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không thể xoay khóa.');
    } finally {
      setBusy(false);
    }
  }

  const stagingAcceptance = import.meta.env.VITE_MP_ENVIRONMENT === 'staging' && provider === 'muse';
  const activeScopes = scopeDefs.filter(s => stagingAcceptance || s.provider === provider);
  const rejectedReceipts = receipts.filter(r => r.outcome === 'rejected');

  function explainRejectReason(code: string | null, status: number) {
    if (code === 'UNAUTHORIZED' || status === 401) return 'Sai Webhook Secret (header X-Pancake-Secret không khớp)';
    if (code === 'WRONG_SHOP' || status === 403) return 'Sai Shop ID (đơn hoặc sự kiện thuộc shop khác)';
    if (code === 'UNRECOGNIZED_EVENT' || status === 422) return 'Sai cấu trúc dữ liệu hoặc không nhận diện được loại sự kiện';
    if (code === 'PILOT_FILTERED') return 'Bỏ qua do đang bật Pilot (chỉ nhận đơn thử)';
    if (code === 'INVALID_INPUT' || status === 400) return 'Dữ liệu payload không đúng định dạng';
    return code ? `Từ chối: ${code} (HTTP ${status})` : `Lỗi HTTP ${status}`;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <div className="flex items-center justify-between">
        <Button onClick={() => onNavigate('dashboard')}>Về Dashboard</Button>
        <span className="text-xs text-slate-500 font-mono">Mega Phương V2.5.0 · Phase 3</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">Quản lý Kết nối & Tích hợp</h1>
          <p className="text-sm text-slate-600">Cổng giao tiếp tự động hóa với Pancake POS và Muse.AI</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || logsLoading} onClick={() => { void refreshKeys(); void loadWebhookLogs(); }}>
            {logsLoading ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">{error}</p>}
      {settingsMessage && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 border border-emerald-200">{settingsMessage}</p>}

      {keys.some(key => !key.revoked_at && Date.parse(key.expires_at) > Date.now() && Date.parse(key.expires_at) - Date.now() <= 30 * 86400000) && (
        <div role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950 border border-amber-200 flex items-center justify-between">
          <span>Có khóa API sẽ hết hạn trong 30 ngày. Vui lòng xoay khóa và cập nhật connector trước khi khóa hết hiệu lực.</span>
        </div>
      )}

      {/* Navigation tabs */}
      <nav aria-label="Dịch vụ kết nối" className="flex gap-2 border-b border-slate-200 pb-2">
        <Button variant={provider === 'pos' ? 'primary' : 'outline'} onClick={() => handleTabChange('pos')}>
          Pancake POS & Webhook
        </Button>
        <Button variant={provider === 'muse' ? 'primary' : 'outline'} onClick={() => handleTabChange('muse')}>
          Muse.AI (REST & MCP)
        </Button>
      </nav>

      {provider === 'pos' ? (
        <section className="space-y-6">
          <PurchaseAutomation send={send}/>
          <ReminderBatchReview send={send}/>
          {/* Cấu hình POS */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Cấu hình kết nối Pancake POS</h2>
            {!settings.encryption_configured && (
              <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded">
                Cần cài đặt biến môi trường mã hóa trên máy chủ trước khi lưu khóa bí mật.
              </p>
            )}
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); void saveConnection('pancake'); }}>
              <label className="grid gap-1 text-sm font-medium">Shop ID
                <input className="rounded border border-slate-300 p-2 text-sm" required pattern="[0-9]{1,20}" inputMode="numeric" value={shop} onChange={e => setShop(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium">API key của shop
                <input className="rounded border border-slate-300 p-2 text-sm" type="password" autoComplete="new-password" value={apiKey}
                  placeholder={settings.api_key_configured ? 'Đã cấu hình' : 'Nhập API key'} onChange={e => setApiKey(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium">Webhook secret
                <input className="rounded border border-slate-300 p-2 text-sm" type="password" autoComplete="new-password" value={webhookSecret}
                  placeholder={settings.webhook_secret_configured ? 'Đã cấu hình' : 'Tối thiểu 24 ký tự'} onChange={e => setWebhookSecret(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button type="submit" disabled={busy || !settings.encryption_configured}>Lưu cấu hình POS</Button>
                <Button type="button" variant="outline" disabled={busy || !settings.api_key_configured} onClick={() => void saveConnection('test')}>Kiểm tra kết nối POS</Button>
              </div>
            </form>
            <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1 font-mono text-slate-700">
              <p>URL Webhook tiếp nhận: <strong>{window.location.origin}/api/webhooks/pancake-pos</strong></p>
              <p className="font-sans text-slate-600">Header bắt buộc: <code>X-Pancake-Secret</code>. Sự kiện hỗ trợ: Đơn hàng, Khách hàng, Sản phẩm.</p>
            </div>
          </div>

          {/* Webhook Observability Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Quan sát Webhook & Hàng đợi</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                  Tự làm mới mỗi 30s
                </label>
                <Button size="sm" variant="outline" disabled={busy || logsLoading} onClick={() => void runSync('logs')}>
                  {logsLoading ? 'Đang đọc...' : 'XEM LỊCH SỬ'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void configureSchedule()}>Xem lịch đồng bộ POS</Button>
                <Button type="button" disabled={busy || !settings.api_key_configured} onClick={() => void runSync('incremental')}>Đồng bộ từ mốc gần nhất</Button>
              </div>
              {scheduleConfig && <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={scheduleConfig.enabled} onChange={e => setScheduleConfig({...scheduleConfig,enabled:e.target.checked})} />
                  Bật đồng bộ đơn hàng, khách hàng và sản phẩm theo lịch
                </label>
                <label className="flex flex-wrap items-center gap-2 text-sm">Chu kỳ (phút)
                  <input className="rounded border p-2 w-28" type="number" min={1} max={10080} value={scheduleConfig.interval_minutes} onChange={e => setScheduleConfig({...scheduleConfig,interval_minutes:Number(e.target.value)})} />
                </label>
                <p className="text-sm text-slate-600">Bộ kích hoạt cron cần được cấu hình trên máy chủ. Thay đổi chu kỳ có hiệu lực ở lần kích hoạt tiếp theo.</p>
                {scheduleConfig.consecutive_failures >= 3 && <p role="alert" className="text-sm text-red-700">Lịch đồng bộ đang tạm dừng sau {scheduleConfig.consecutive_failures} lỗi liên tiếp. Lỗi gần nhất {scheduleConfig.last_error}. Kiểm tra kết nối và lưu lại cấu hình để cho phép thử lại.</p>}
                <Button type="button" disabled={busy || !Number.isInteger(scheduleConfig.interval_minutes) || scheduleConfig.interval_minutes < 1 || scheduleConfig.interval_minutes > 10080} onClick={() => void configureSchedule(true)}>Lưu lịch đồng bộ</Button>
              </>}
            </div>
            {/* Metrics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3">
                <span className="text-xs text-blue-800 font-medium">Đang chờ xử lý</span>
                <p className="text-2xl font-bold text-blue-950 mt-1">{syncState?.pending ?? 0}</p>
              </div>
              <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 p-3">
                <span className="text-xs text-emerald-800 font-medium">Đơn hàng 24h</span>
                <p className="text-2xl font-bold text-emerald-950 mt-1">{syncState?.events_24h?.orders ?? 0}</p>
              </div>
              <div className="rounded-lg bg-red-50/70 border border-red-100 p-3">
                <span className="text-xs text-red-800 font-medium">Lỗi cuối (Dead)</span>
                <p className="text-2xl font-bold text-red-950 mt-1">{syncState?.dead ?? 0}</p>
              </div>
              <div className="rounded-lg bg-amber-50/70 border border-amber-100 p-3">
                <span className="text-xs text-amber-800 font-medium">Từ chối 24h</span>
                <p className="text-2xl font-bold text-amber-950 mt-1">{syncState?.rejected_24h ?? 0}</p>
              </div>
            </div>

            {/* Pilot Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Chế độ Pilot:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${syncState?.pilot_mode ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                  {syncState?.pilot_mode ? 'BẬT (Giới hạn)' : 'TẮT (Tất cả đơn)'}
                </span>
                {syncState?.pilot_order_id && (
                  <span className="text-slate-600">Chỉ xử lý đơn: <strong>{syncState.pilot_order_id}</strong></span>
                )}
              </div>
              {syncState?.pilot_mode && syncState?.pilot_order_id && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void runSync('pilot')}>
                  Đồng bộ đơn thử {syncState.pilot_order_id}
                </Button>
              )}
            </div>

            {/* Sync control buttons */}
            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100">
              <label className="text-sm font-medium">Phạm vi đồng bộ
                <select className="ml-2 rounded border border-slate-300 p-1.5 text-sm" value={scope} disabled={busy} onChange={e => {
                  setScope(e.target.value);
                  setNextPage(null);
                }}>
                  <option value="orders">Đơn hàng</option>
                  <option value="customers">Khách hàng</option>
                  <option value="products">Biến thể sản phẩm</option>
                </select>
              </label>
              {scope === 'orders' && (
                <>
                  <label className="text-sm">Từ <input className="rounded border border-slate-300 p-1 text-sm ml-1" type="datetime-local" value={from} disabled={busy} onChange={e => { setFrom(e.target.value); setNextPage(null); }} /></label>
                  <label className="text-sm">Đến <input className="rounded border border-slate-300 p-1 text-sm ml-1" type="datetime-local" value={to} disabled={busy} onChange={e => { setTo(e.target.value); setNextPage(null); }} /></label>
                </>
              )}
              <Button disabled={busy || (scope === 'orders' && (!from || !to || from >= to))} onClick={() => void runSync('run')}>
                {nextPage ? 'Lấy trang ' + nextPage.next_page : 'Đưa dữ liệu vào hàng đợi'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void runSync('process')}>Xử lý hàng đợi</Button>
            </div>
            {syncMessage && <p role="status" className="text-sm text-blue-900 bg-blue-50 p-2 rounded">{syncMessage}</p>}
          </div>

          {/* Webhook Events Table with Filter */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">Sự kiện Webhook gần nhất ({totalEventEntries} bản ghi)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Lọc mã POS..."
                  value={eventFilterPosId}
                  onChange={e => setEventFilterPosId(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs w-28"
                />
                <select
                  value={eventFilterKind}
                  onChange={e => setEventFilterKind(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">Tất cả loại</option>
                  <option value="orders">Đơn hàng</option>
                  <option value="customers">Khách hàng</option>
                  <option value="products">Sản phẩm</option>
                </select>
                <select
                  value={eventFilterStatus}
                  onChange={e => setEventFilterStatus(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Đang chờ (pending)</option>
                  <option value="done">Hoàn tất (done)</option>
                  <option value="stale">Bỏ qua (stale)</option>
                  <option value="dead">Lỗi cuối (dead)</option>
                </select>
                <Button size="sm" variant="outline" onClick={() => void loadWebhookLogs(1, eventFilterPosId, eventFilterKind, eventFilterStatus)}>
                  Lọc
                </Button>
              </div>
            </div>

            {!events.length ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">Chưa có sự kiện nào khớp với bộ lọc.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b">
                    <tr>
                      <th className="p-2">Thời gian nhận</th>
                      <th className="p-2">Mã POS</th>
                      <th className="p-2">Loại</th>
                      <th className="p-2">Nguồn</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2">Lần thử</th>
                      <th className="p-2">Xử lý lúc</th>
                      <th className="p-2">Lỗi / Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map(event => (
                      <tr key={event.id} className="hover:bg-slate-50/50">
                        <td className="p-2 font-mono whitespace-nowrap">{new Date(event.received_at).toLocaleString('vi-VN')}</td>
                        <td className="p-2 font-mono font-bold text-blue-900">{event.pos_id ?? '—'}</td>
                        <td className="p-2 font-medium">{event.object_type ?? event.kind}</td>
                        <td className="p-2 text-slate-600">{event.source}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            event.status === 'done' ? 'bg-emerald-100 text-emerald-800' :
                            event.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                            event.status === 'dead' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="p-2 text-center">{event.attempts}</td>
                        <td className="p-2 font-mono text-slate-500 whitespace-nowrap">
                          {event.processed_at ? new Date(event.processed_at).toLocaleString('vi-VN') : '—'}
                        </td>
                        <td className="p-2 text-red-600 max-w-xs truncate" title={event.last_error || ''}>
                          {event.last_error || '—'}
                          {event.status === 'dead' && (
                            <button disabled={busy} className="ml-2 font-bold text-blue-600 underline" onClick={() => void retryEvent(event.id)}>
                              Thử lại
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {eventTotalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t">
                <span>Trang {eventPage} / {eventTotalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={eventPage <= 1} onClick={() => void loadWebhookLogs(eventPage - 1, eventFilterPosId, eventFilterKind, eventFilterStatus)}>Trước</Button>
                  <Button size="sm" variant="outline" disabled={eventPage >= eventTotalPages} onClick={() => void loadWebhookLogs(eventPage + 1, eventFilterPosId, eventFilterKind, eventFilterStatus)}>Sau</Button>
                </div>
              </div>
            )}
          </div>

          {/* Rejected Receipts Detail Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Chi tiết các lượt tiếp nhận Webhook bị từ chối (Rejected)</h3>
            <p className="text-xs text-slate-600">Giúp người quản trị tra cứu nguyên nhân chính xác của từng lần webhook bị từ chối trong 24 giờ qua.</p>
            {!rejectedReceipts.length ? (
              <p className="text-sm text-slate-500 italic py-2">Không có lượt tiếp nhận nào bị từ chối gần đây.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rejectedReceipts.map(r => (
                  <li key={r.id} className="py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-slate-500 mr-2">{new Date(r.received_at).toLocaleString('vi-VN')}</span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold mr-2">HTTP {r.http_status}</span>
                      <strong className="text-slate-800">{explainRejectReason(r.error_code, r.http_status)}</strong>
                    </div>
                    <span className="text-slate-500 font-mono">Loại: {r.kind || 'không xác định'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          {/* Muse Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Kết nối Muse.AI</h2>
            <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1 font-mono text-slate-700">
              <p>REST API: <strong>{window.location.origin}/api/v1</strong></p>
              <p>MCP Server (Streamable HTTP): <strong>{window.location.origin}/mcp</strong></p>
            </div>
            <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void saveConnection('muse'); }}>
              <label className="grid flex-1 gap-1 text-sm font-medium">
                HTTPS origin của Muse (nếu connector gửi header Origin)
                <input className="rounded border border-slate-300 p-2 text-sm" type="url" value={museOrigin} placeholder="https://..." onChange={e => setMuseOrigin(e.target.value)} />
              </label>
              <Button type="submit" disabled={busy}>Lưu cấu hình Muse</Button>
            </form>

            {/* Reminder configuration */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-900">Cấu hình nhắc học viên</h3>
              <p className="text-xs text-slate-600">Mega Phương tự động tính toán thời hạn, lọc danh sách học viên và ghi nhận lượt nhắc đã gửi.</p>
              {!reminderConfig ? (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveReminderSettings(true)}>
                  Xem cài đặt ngưỡng ngày nhắc
                </Button>
              ) : (
                <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void saveReminderSettings(); }}>
                  <label className="grid gap-1 text-sm">Sắp hết hạn trong (ngày, tối đa 90)
                    <input className="rounded border border-slate-300 p-2 text-sm" type="number" min={1} max={90} required value={reminderConfig.expiring_threshold_days}
                      onChange={e => setReminderConfig({ ...reminderConfig, expiring_threshold_days: e.target.valueAsNumber })} />
                  </label>
                  <label className="grid gap-1 text-sm">Ẩn học viên đã nhắc trong (ngày)
                    <input className="rounded border border-slate-300 p-2 text-sm" type="number" min={0} max={90} required value={reminderConfig.reminder_cooldown_days}
                      onChange={e => setReminderConfig({ ...reminderConfig, reminder_cooldown_days: e.target.valueAsNumber })} />
                  </label>
                  <Button type="submit" disabled={busy}>Lưu cài đặt nhắc</Button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* API Keys Management Section */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Khóa API {provider === 'pos' ? 'Pancake POS' : 'Muse.AI'}
          </h2>
          <Button variant="outline" size="sm" onClick={() => void refreshKeys()}>Làm mới khóa</Button>
        </div>

        <p className="text-xs text-slate-600">
          {provider === 'pos'
            ? 'Quyền đọc truy xuất danh mục Mega Phương và dữ liệu POS. Quyền ghi đưa sự kiện vào hàng đợi.'
            : 'Chọn từng quyền đọc và quyền ghi phù hợp: sửa ghi chú khách hàng, ghi nhận nhắc gia hạn, tạo/sửa phác đồ học viên, tự động gia hạn phác đồ, và ghi nhận mua dụng cụ. Các ô quyền được nạp động từ Scope Registry máy chủ.'}
        </p>

        {stagingAcceptance && <p className="text-xs text-slate-600">
          Khóa nghiệm thu staging có thể chọn đủ 19 quyền. Hai quyền POS được giới hạn theo shop thử nghiệm đã cấu hình.
        </p>}
        {/* Create Key Form */}
        <form className="space-y-4 rounded-lg bg-slate-50 p-4 border border-slate-200" onSubmit={e => {
          e.preventDefault();
          void changeKey('POST', { label, scopes: selected, key_type: keyType, days: keyDays });
        }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">Tên khóa (duy nhất)
              <input value={label} onChange={e => setLabel(e.target.value)} required pattern="[A-Za-z0-9_-]{1,64}"
                placeholder="VD: MuseAI_Connector" className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Loại khóa
              <select className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" value={keyType} onChange={e => {
                const type = e.target.value as 'user' | 'service';
                setKeyType(type);
                setKeyDays(type === 'service' ? 365 : 30);
              }}>
                <option value="service">Dịch vụ tự động (tối đa 730 ngày)</option>
                <option value="user">Người dùng (tối đa 365 ngày)</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Thời hạn (ngày)
              <input className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" type="number" min={1} max={keyType === 'service' ? 730 : 365}
                required value={keyDays} onChange={e => setKeyDays(Number(e.target.value))} />
            </label>
          </div>

          <fieldset className="space-y-2 border-t border-slate-200 pt-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Danh mục quyền hạn (Registry Server · {activeScopes.length} quyền)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeScopes.map(def => (
                <label key={def.scope} className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selected.includes(def.scope) ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes(def.scope)}
                    onChange={e => {
                      const checked = e.target.checked;
                      setSelected(old => checked ? [...old, def.scope] : old.filter(x => x !== def.scope));
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="font-bold text-blue-900">{def.scope}</code>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold ${
                        def.category === 'write' ? 'bg-amber-100 text-amber-800' :
                        def.category === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {def.category}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-snug">{def.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" disabled={busy || !label || !selected.length}>
            Tạo khóa {keyDays} ngày
          </Button>
        </form>

        {/* Revealed New Key Banner */}
        {newKey && (
          <div role="status" className="break-all rounded-lg bg-amber-50 p-4 border border-amber-300 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-amber-900 text-sm">Khóa API mới (Chỉ hiển thị 1 lần duy nhất):</strong>
              <Button size="sm" variant="outline" onClick={() => setNewKey('')}>Đã lưu & Ẩn khóa</Button>
            </div>
            <code className="block p-2 bg-white rounded border border-amber-200 font-mono text-sm text-blue-900 font-bold select-all">
              {newKey}
            </code>
            <p className="text-xs text-amber-800">
              Vui lòng sao chép khóa này ngay vào kho bảo mật (Vault / Environment). Khóa không thể hiển thị lại sau khi bạn đóng banner này.
            </p>
          </div>
        )}

        {/* Existing Keys List */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-slate-800">Danh sách khóa đang cấu hình</h3>
          <ul className="divide-y divide-slate-200 border rounded-lg overflow-hidden">
            {keys.filter(key => key.scopes.some(scope => scope.startsWith('pos:')) === (provider === 'pos')).map(key => {
              const isRevoked = !!key.revoked_at;
              const isExpired = Date.parse(key.expires_at) <= Date.now();
              const daysLeft = Math.ceil((Date.parse(key.expires_at) - Date.now()) / 86400000);

              return (
                <li key={key.label} className="p-4 space-y-2 text-xs bg-white hover:bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-slate-900">{key.label}</strong>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {key.key_type === 'service' ? 'Dịch vụ' : 'Người dùng'}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        isRevoked ? 'bg-red-100 text-red-800' :
                        isExpired ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isRevoked ? 'Đã thu hồi' : isExpired ? 'Hết hạn' : 'Đang hoạt động'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRevoked && !isExpired && (
                        <button
                          className="font-medium text-blue-700 hover:underline"
                          onClick={() => {
                            if (editingKeyId === key.id) {
                              setEditingKeyId(null);
                            } else {
                              setEditingKeyId(key.id);
                              setEditScopes([...key.scopes]);
                            }
                          }}
                        >
                          {editingKeyId === key.id ? 'Đóng sửa quyền' : 'Sửa quyền'}
                        </button>
                      )}

                      {!isRevoked && (confirmLabel === key.label ? (
                        <>
                          <button className="font-bold text-red-700 underline" disabled={busy} onClick={() => void changeKey('DELETE', { label: key.label })}>
                            Xác nhận thu hồi
                          </button>
                          <button onClick={() => setConfirmLabel('')} className="text-slate-500">Hủy</button>
                        </>
                      ) : (
                        <button className="text-red-600 hover:underline" onClick={() => setConfirmLabel(key.label)}>
                          Thu hồi
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scopes badge list */}
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Edit Scopes Drawer / Inline */}
                  {editingKeyId === key.id && (
                    <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-200 space-y-2 mt-2">
                      <strong className="text-xs text-blue-900">Sửa phạm vi quyền cho khóa {key.label}:</strong>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeScopes.map(def => (
                          <label key={def.scope} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={editScopes.includes(def.scope)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEditScopes(old => checked ? [...old, def.scope] : old.filter(x => x !== def.scope));
                              }}
                            />
                            <code>{def.scope}</code> - {def.name}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={busy || !editScopes.length}
                          onClick={() => void changeKey('PATCH', { id: key.id, scopes: editScopes })}
                        >
                          Lưu quyền
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingKeyId(null)}>Hủy</Button>
                      </div>
                    </div>
                  )}

                  {/* Expiration and usage details */}
                  <div className="flex flex-wrap items-center justify-between text-slate-600 text-xs pt-1 border-t border-slate-100">
                    <div className="space-x-3">
                      <span>Hết hạn: {new Date(key.expires_at).toLocaleString('vi-VN')}</span>
                      {!isRevoked && !isExpired && (
                        daysLeft <= 1 ? <strong className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">Còn dưới 24 giờ</strong> :
                        daysLeft <= 7 ? <strong className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">Còn {daysLeft} ngày</strong> :
                        daysLeft <= 30 ? <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-900 font-medium">Còn {daysLeft} ngày</span> : null
                      )}
                      <span>Dùng gần nhất: <strong>{key.last_used_at ? new Date(key.last_used_at).toLocaleString('vi-VN') : 'chưa sử dụng'}</strong></span>
                    </div>

                    {key.key_type === 'service' && !isRevoked && !key.grace_until && !isExpired && (
                      rotateId === key.id ? (
                        <div className="space-x-2">
                          <span className="text-amber-800">Khóa cũ còn hiệu lực 7 ngày sau khi xoay.</span>
                          <button className="font-bold underline text-blue-700" disabled={busy} onClick={() => void rotateKey(key.id)}>
                            Xác nhận xoay
                          </button>
                          <button onClick={() => setRotateId('')}>Hủy</button>
                        </div>
                      ) : (
                        <button className="underline text-blue-600" disabled={busy} onClick={() => { setRotateId(key.id); setNewKey(''); }}>
                          Xoay khóa
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
