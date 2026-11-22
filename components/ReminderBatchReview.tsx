import React,{useState} from 'react';
import {Button} from './UI';
type Send=(method:string,body?:unknown,path?:string)=>Promise<any>;
export function ReminderBatchReview({send}:{send:Send}) {
  const [batches,setBatches]=useState<any[]>([]),[detail,setDetail]=useState<any>(null);
  const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function load(id?:string) {
    setBusy(true);setError('');
    try {
      if(id) {
        const next=await send('GET',undefined,'admin/reminders/batches/'+id);setDetail(next);
        setSelected(next.items.filter((i:any)=>i.status==='preview').map((i:any)=>i.student_id));
      } else setBatches(await send('GET',undefined,'admin/reminders/batches'));
    } catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function approve(cancel=false) {
    setBusy(true);setError('');
    try {
      await send('POST',{version:detail.updated_at,student_ids:selected},'admin/reminders/batches/'+detail.id+'/'+(cancel?'cancel':'approve'));
      await load(detail.id);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="rounded-xl border bg-white p-5 space-y-4">
    <h2 className="text-lg font-semibold">Duyệt danh sách nhắc hẹn giờ</h2>
    <p className="text-sm text-slate-600">Muse chuẩn bị danh sách và mẫu tin qua API. Sau khi duyệt, Muse tạo nhiệm vụ theo giờ hẹn và kiểm tra lại từng người trước khi gửi.</p>
    <Button variant="outline" disabled={busy} onClick={()=>void load()}>Đọc 25 danh sách gần nhất</Button>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">{batches.map(batch=><Button key={batch.id} variant="outline" disabled={busy} onClick={()=>void load(batch.id)}>
      {new Date(batch.scheduled_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {batch.kind} · {batch.status}
    </Button>)}</div>
    {detail&&<>
      <p>Giờ gửi (Việt Nam) · {new Date(detail.scheduled_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>
      <p>Nhóm · {detail.kind} · Trong {detail.days} ngày · Trạng thái {detail.status}</p>
      <p className="font-semibold">Mẫu {detail.template_id}</p><pre className="whitespace-pre-wrap font-sans rounded bg-slate-50 p-3">{detail.template_text}</pre>
      {detail.items.map((item:any)=><label key={item.student_id} className="flex items-start gap-2 rounded border p-3 text-sm">
        {detail.status==='preview'&&item.status==='preview'&&<input type="checkbox" disabled={busy} checked={selected.includes(item.student_id)}
          onChange={e=>setSelected(e.target.checked?[...selected,item.student_id]:selected.filter(id=>id!==item.student_id))}/>}
        <span>{item.student_name} ({item.student_id}) · Hết hạn {item.end_date} · Nhắc trước {item.last_reminded_at?new Date(item.last_reminded_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'chưa có'} · {item.status}{item.reason?' · '+item.reason:''}</span>
      </label>)}
      <div className="flex gap-2">
        {detail.status==='preview'&&<Button disabled={busy||selected.length===0} onClick={()=>void approve()}>Duyệt {selected.length} học viên và mẫu tin trên</Button>}
        {detail.status!=='cancelled'&&<Button variant="outline" disabled={busy} onClick={()=>void approve(true)}>Hủy các lượt chưa bắt đầu gửi</Button>}
      </div>
    </>}
  </section>;
}
