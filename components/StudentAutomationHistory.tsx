import React,{useState} from 'react';
import {Button} from './UI';
import {integrationAdmin as send} from '../src/lib/integrationAdmin';
const time=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export function StudentAutomationHistory({studentId}:{studentId:string}) {
  const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [filter,setFilter]=useState('all'),[reasons,setReasons]=useState<Record<string,string>>({});
  async function load() {
    setBusy(true);setError('');
    try {
      const id=encodeURIComponent(studentId);
      const [states,reminders,extensions,purchases,notifications]=await Promise.all([
        send('GET',undefined,'admin/students/'+id+'/protocol-state-history'),
        send('GET',undefined,'admin/reminders/history?student_id='+id),
        send('GET',undefined,'admin/students/'+id+'/extensions'),
        send('GET',undefined,'admin/students/'+id+'/purchases'),
        send('GET',undefined,'admin/automation/notifications?student_id='+id)]);
      setData({states,reminders:reminders.items,extensions,purchases:purchases.items,notifications});
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function voidLine(id:string) {
    setBusy(true);setError('');
    try {await send('POST',{reason:reasons[id]},'admin/purchases/'+id+'/void');await load();}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="mt-6 border-t pt-5 space-y-3">
    <h3 className="font-semibold">Lịch sử tự động hóa học viên</h3>
    <Button variant="outline" disabled={busy} onClick={()=>void load()}>Đọc lịch sử và mua hàng</Button>
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
    {data&&<>
      <label className="text-sm">Lọc đóng/mở phác đồ <select className="rounded border p-2" value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="all">Tất cả</option><option value="deactivate">Đóng</option><option value="reactivate">Mở lại</option>
      </select></label>
      {data.states.filter((r:any)=>filter==='all'||r.action===filter).map((r:any)=><div key={r.id} className="rounded border p-3 text-sm space-y-1">
        <p>{time(r.created_at)} · {r.action==='deactivate'?'Đóng':'Mở lại'} · {r.reason} · Bù {r.days_compensated} ngày</p>
        <p>{r.note} · Thực hiện {r.actor?.label??'Khóa tích hợp'}</p>
        <p className="break-all">Hội thoại {r.conversation_id} · Tin {r.message_id} · Nhiệm vụ {r.task_id}</p>
      </div>)}
      <h4 className="font-semibold text-sm">Gia hạn và hoàn tác</h4>
      {data.extensions.map((r:any)=><p key={r.id} className="text-sm">{time(r.created_at)} · {r.old_end_date} → {r.new_end_date} · {r.reason}{r.reverted_from?' · Hoàn tác':''}</p>)}
      <h4 className="font-semibold text-sm">Nhắc học viên (50 lượt gần nhất)</h4>
      {data.reminders.map((r:any)=><p key={r.id} className="text-sm break-all">{time(r.sent_at)} · {r.type} · {r.actor?.label??'Khóa tích hợp'} · Mẫu {r.template_id??'chưa ghi'} · Tin {r.message_ref??'chưa ghi'} · Nhiệm vụ {r.task_id??'chưa ghi'}</p>)}
      <h4 className="font-semibold text-sm">Thông báo gửi link và gia hạn</h4>
      {data.notifications.map((r:any)=><p key={r.id} className="text-sm break-all">{time(r.sent_at)} · {r.type} · {r.actor?.label??'Khóa tích hợp'} · Mẫu {r.template_id} · Tin {r.message_ref} · Nhiệm vụ {r.task_id}</p>)}
      <h4 className="font-semibold text-sm">Mua hàng (25 dòng gần nhất)</h4>
      {data.purchases.map((r:any)=><article key={r.id} className="rounded border p-3 text-sm space-y-2">
        <p>{r.product_name} · {r.quantity} × {Number(r.unit_price).toLocaleString('vi-VN')}đ · {r.status} · Đơn {r.pos_order_id??'thủ công'}</p>
        {r.status!=='void'&&<div className="flex gap-2 flex-wrap">
          <input className="rounded border p-2 flex-1" placeholder="Lý do vô hiệu hóa dòng mua hàng" maxLength={500} value={reasons[r.id]??''} onChange={e=>setReasons({...reasons,[r.id]:e.target.value})}/>
          <Button variant="outline" disabled={busy||!reasons[r.id]?.trim()} onClick={()=>void voidLine(r.id)}>Vô hiệu hóa, giữ lịch sử</Button>
        </div>}
      </article>)}
      {data.states.length+data.extensions.length+data.reminders.length+data.purchases.length+data.notifications.length===0&&<p className="text-sm">Chưa có lịch sử tự động hóa.</p>}
    </>}
  </section>;
}
