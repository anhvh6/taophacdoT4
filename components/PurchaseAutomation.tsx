import React, {useState} from 'react';
import {Button} from './UI';

type QueueItem = {
  id:string;pos_order_id:string;reason:string;candidates:string[];updated_at:string;
};
type Settings = {auto_record_purchase_enabled:boolean;auto_protocol_state_enabled:boolean;auto_remind_enabled:boolean;
  auto_create_protocol_enabled:boolean;auto_extend_enabled:boolean;default_duration_days:number;default_link_send_time:string;updated_at:string|null;
  expiring_threshold_days:number;recently_expired_days:number;reminder_cooldown_days:number;tools_product_ids:string[]};
type Send = (method:string,body?:unknown,path?:string)=>Promise<any>;

export function PurchaseAutomation({send}:{send:Send}) {
  const [settings,setSettings]=useState<Settings|null>(null);
  const [items,setItems]=useState<QueueItem[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [student,setStudent]=useState<Record<string,string>>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [toolsText,setToolsText]=useState('');
  const [lookup,setLookup]=useState('');
  const [history,setHistory]=useState<any[]>([]);
  const [reminders,setReminders]=useState<any[]>([]);
  const [summary,setSummary]=useState<any[]|null>(null);
  const [business,setBusiness]=useState<Record<string,number|null>|null>(null);
  const [extension,setExtension]=useState<{days_per_month:number;previous:number}|null>(null);
  const [exclusionReason,setExclusionReason]=useState('');
  async function saveExclusion(active:boolean) {
    setBusy(true);setError('');setMessage('');
    try {
      await send('PUT',{active,reason:exclusionReason},'admin/students/'+encodeURIComponent(lookup.trim())+'/reminder-exclusion');
      setMessage(active?'Đã loại học viên khỏi các lượt nhắc.':'Đã gỡ loại trừ nhắc cho học viên.');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function saveExtension() {
    if(!extension) return;setBusy(true);setError('');
    try {
      const saved=await send('PUT',extension,'admin/automation/extension-settings');
      setExtension({...saved,previous:saved.days_per_month});setMessage('Đã lưu số ngày cho một đơn vị gia hạn từ hội thoại.');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }

  async function inspect() {
    if(!/^[\w-]{1,128}$/.test(lookup.trim())) {setError('Nhập mã học viên cần tra cứu.');return;}
    setBusy(true);setError('');
    try {
      const id=encodeURIComponent(lookup.trim());
      const [states,sent,daily]=await Promise.all([
        send('GET',undefined,'admin/students/'+id+'/protocol-state-history'),
        send('GET',undefined,'admin/reminders/history?student_id='+id),
        send('GET',undefined,'admin/automation/daily-summary')]);
      setHistory(states);setReminders(sent.items);setSummary(daily.actions);
      setBusiness(daily.business_totals);
    } catch(e:any) {setError(e.message);} finally {setBusy(false);}
  }

  async function load(nextPage=1) {
    setBusy(true);setError('');
    try {
      const [config,queue,extend]=await Promise.all([
        send('GET',undefined,'admin/automation/settings'),
        send('GET',undefined,'admin/orders/unmatched?page_number='+nextPage),send('GET',undefined,'admin/automation/extension-settings')
      ]);
      setSettings(config);setItems(queue.items);setTotal(queue.total_entries);setPage(nextPage);
      setToolsText(config.tools_product_ids.join('\n'));
      setExtension({...extend,previous:extend.days_per_month});
    } catch(e:any) {setError(e.message);} finally {setBusy(false);}
  }
  async function save() {
    if(!settings) return;
    setBusy(true);setError('');setMessage('');
    try {
      const updated=await send('PUT',{version:settings.updated_at,
        auto_record_purchase_enabled:settings.auto_record_purchase_enabled,
        auto_protocol_state_enabled:settings.auto_protocol_state_enabled,
        auto_remind_enabled:settings.auto_remind_enabled,
        auto_create_protocol_enabled:settings.auto_create_protocol_enabled,auto_extend_enabled:settings.auto_extend_enabled,
        default_duration_days:settings.default_duration_days,default_link_send_time:settings.default_link_send_time,
        expiring_threshold_days:settings.expiring_threshold_days,recently_expired_days:settings.recently_expired_days,
        reminder_cooldown_days:settings.reminder_cooldown_days,
        tools_product_ids:[...new Set(toolsText.split('\n').map(v=>v.trim()).filter(Boolean))]},'admin/automation/settings');
      setSettings(updated);setMessage('Đã lưu cấu hình tự động hóa.');
      setToolsText(updated.tools_product_ids.join('\n'));
    } catch(e:any) {setError(e.message);} finally {setBusy(false);}
  }
  async function review(item:QueueItem,dismiss:boolean) {
    setBusy(true);setError('');setMessage('');
    try {
      await send('POST',{version:item.updated_at,note:notes[item.id],student_id:student[item.id]},
        'admin/orders/unmatched/'+item.id+'/'+(dismiss?'dismiss':'resolve'));
      setMessage(dismiss?'Đã bỏ qua đơn và lưu lý do.':'Đã ghép đơn. Lượt xử lý tuân theo công tắc ghi mua hàng.');
      await load(page);
    } catch(e:any) {setError(e.message);} finally {setBusy(false);}
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <h2 className="text-lg font-semibold">Tự động hóa và rà soát đơn</h2>
      <Button variant="outline" disabled={busy} onClick={()=>void load()}>Đọc cấu hình và hàng đợi</Button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-emerald-800">{message}</p>}
    {settings && <>
      {([['auto_create_protocol_enabled','Tạo phác đồ từ sự kiện đã xác nhận tiền'],['auto_extend_enabled','Gia hạn và hoàn tác theo sự kiện hội thoại']] as const).map(([field,label])=><label className="flex items-center gap-2" key={field}>
        <input type="checkbox" disabled={busy} checked={settings[field]} onChange={e=>setSettings({...settings,[field]:e.target.checked})}/>{label}
      </label>)}
      <label className="flex items-center gap-2">
        <input type="checkbox" disabled={busy} checked={settings.auto_record_purchase_enabled}
          onChange={e=>setSettings({...settings,auto_record_purchase_enabled:e.target.checked})}/>
        Ghi dòng mua hàng từ đơn POS đã xác nhận đủ tiền
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" disabled={busy} checked={settings.auto_protocol_state_enabled}
          onChange={e=>setSettings({...settings,auto_protocol_state_enabled:e.target.checked})}/>
        Cho phép Muse đóng/mở phác đồ theo sự kiện hội thoại
      </label>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={busy} checked={settings.auto_remind_enabled}
            onChange={e=>setSettings({...settings,auto_remind_enabled:e.target.checked})}/>
          Cho phép Muse thực hiện lượt nhắc đã được duyệt
        </label>
        {([['expiring_threshold_days','Sắp hết hạn trong số ngày',30],['recently_expired_days','Mới hết hạn trong số ngày',90],
          ['reminder_cooldown_days','Số ngày giữa hai lần nhắc',90]] as const).map(([field,label,max])=><label className="text-sm" key={field}>{label}
          <input className="block w-full rounded border p-2 mt-1" type="number" min={field==='reminder_cooldown_days'?0:1} max={max} disabled={busy}
            value={settings[field]} onChange={e=>setSettings({...settings,[field]:Number(e.target.value)})}/>
        </label>)}
      </div>
      <label className="block text-sm">ID sản phẩm hoặc mẫu mã được tính là dụng cụ (mỗi dòng một ID)
        <textarea className="block w-full rounded border p-2 mt-1" rows={3} disabled={busy}
          value={toolsText} onChange={e=>setToolsText(e.target.value)}/>
      </label>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm">Thời hạn phác đồ mặc định (ngày)
          <input type="number" min={1} max={365} className="block w-full rounded border p-2" value={settings.default_duration_days}
            onChange={e=>setSettings({...settings,default_duration_days:Number(e.target.value)})}/>
        </label>
        <label className="text-sm">Giờ gửi link mặc định (Việt Nam)
          <input type="time" className="block w-full rounded border p-2" value={settings.default_link_send_time.slice(0,5)}
            onChange={e=>setSettings({...settings,default_link_send_time:e.target.value})}/>
        </label>
      </div>
      <Button disabled={busy} onClick={()=>void save()}>Lưu cấu hình tự động hóa</Button>
      {extension&&<div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">Số ngày cho một đơn vị gia hạn từ hội thoại
          <input type="number" min={1} max={366} className="block rounded border p-2" value={extension.days_per_month}
            onChange={e=>setExtension({...extension,days_per_month:Number(e.target.value)})}/>
        </label>
        <Button variant="outline" disabled={busy} onClick={()=>void saveExtension()}>Lưu đơn vị gia hạn</Button>
      </div>}
      <p className="text-sm text-slate-600">{total} đơn đang chờ rà soát.</p>
      {items.map(item=><article className="rounded-lg border p-4 space-y-3" key={item.id}>
        <p className="font-semibold">Đơn #{item.pos_order_id}</p>
        <p className="text-sm">Lý do cần rà soát — {item.reason}</p>
        {item.candidates.length>0 && <p className="text-sm">Mã hồ sơ có thể trùng — {item.candidates.join(', ')}</p>}
        <label className="block text-sm">Mã học viên đã đối chiếu
          <input className="block w-full rounded border p-2 mt-1" value={student[item.id]??''}
            onChange={e=>setStudent({...student,[item.id]:e.target.value})}/>
        </label>
        <label className="block text-sm">Lý do ghép hoặc bỏ qua
          <input className="block w-full rounded border p-2 mt-1" maxLength={500} value={notes[item.id]??''}
            onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/>
        </label>
        <div className="flex gap-2">
          <Button disabled={busy||!student[item.id]?.trim()||!notes[item.id]?.trim()} onClick={()=>void review(item,false)}>Ghép học viên</Button>
          <Button variant="outline" disabled={busy||!notes[item.id]?.trim()} onClick={()=>void review(item,true)}>Bỏ qua có lý do</Button>
        </div>
      </article>)}
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy||page===1} onClick={()=>void load(page-1)}>Trang trước</Button>
        <Button variant="outline" disabled={busy||page*25>=total} onClick={()=>void load(page+1)}>Trang sau</Button>
      </div>
    </>}
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-semibold">Lịch sử phác đồ và nhắc học viên</h3>
      <label className="block text-sm">Mã học viên
        <input className="block w-full rounded border p-2 mt-1" value={lookup} onChange={e=>setLookup(e.target.value)}/>
      </label>
      <Button variant="outline" disabled={busy||!lookup.trim()} onClick={()=>void inspect()}>Tra cứu lịch sử</Button>
      <label className="block text-sm">Lý do cập nhật từ chối nhắc
        <input className="block w-full rounded border p-2 mt-1" maxLength={500} value={exclusionReason} onChange={e=>setExclusionReason(e.target.value)}/>
      </label>
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy||!lookup.trim()||!exclusionReason.trim()} onClick={()=>void saveExclusion(true)}>Loại khỏi nhắc</Button>
        <Button variant="outline" disabled={busy||!lookup.trim()||!exclusionReason.trim()} onClick={()=>void saveExclusion(false)}>Gỡ loại trừ nhắc</Button>
      </div>
      {summary!==null && <>
        <p className="text-sm font-semibold">Hoạt động hôm nay (giờ Việt Nam)</p>
        {business&&([['protocols_created','Phác đồ mới'],['extensions','Gia hạn'],['extension_reverts','Hoàn tác gia hạn'],
          ['protocols_closed','Đóng'],['protocols_reopened','Mở lại'],['purchase_lines_recorded','Dòng mua đã ghi'],
          ['reminders_recorded','Lượt nhắc đã ghi'],['protocol_link_notifications','Thông báo link đã ghi'],['renewal_notifications','Thông báo gia hạn đã ghi']] as const)
          .map(([field,label])=><p className="text-sm" key={field}>{label} · {business[field]??0}</p>)}
        <p className="text-xs text-slate-500">Số đơn POS do Muse tạo và ca báo hỗ trợ được đối chiếu thêm từ sổ tác vụ Muse.</p>
        {summary.length===0 && <p className="text-sm">Chưa có hoạt động.</p>}
        {summary.map((row:any)=><p className="text-sm" key={row.action+row.status}>{row.action} · {row.status} · {row.total}</p>)}
        <p className="text-sm font-semibold">Đóng/mở phác đồ</p>
        {history.length===0 && <p className="text-sm">Chưa có lịch sử đóng/mở.</p>}
        {history.map(row=><p className="text-sm" key={row.id}>{new Date(row.created_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {row.action==='deactivate'?'Đóng':'Mở lại'} · {row.reason} · Bù {row.days_compensated} ngày · {row.note}</p>)}
        <p className="text-sm font-semibold">Lịch sử nhắc (50 lượt gần nhất)</p>
        {reminders.length===0 && <p className="text-sm">Chưa có lượt nhắc.</p>}
        {reminders.map(row=><p className="text-sm" key={row.id}>{new Date(row.sent_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {row.type} · {row.channel} · Mã tin {row.message_ref}</p>)}
      </>}
    </div>
  </section>;
}
