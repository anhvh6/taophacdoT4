const DAY=86400000;

/** Civil calendar date in Vietnam; independent of the browser/server timezone. */
export function vietnamDateKey(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function civilDay(input:unknown):number|null {
  if(typeof input!=='string') return null;
  const iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(input.trim());
  const vn=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if(!iso&&!vn) return null;
  const y=Number(iso?iso[1]:vn![3]),m=Number(iso?iso[2]:vn![2]),d=Number(iso?iso[3]:vn![1]);
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) return null;
  return date.getTime()/DAY;
}

export type StudentDates={status?:string|null;start_date?:string|null;end_date?:string|null;protocol_closed_at?:string|null};
export function studentValidity(student:StudentDates,now=new Date()) {
  const today=civilDay(vietnamDateKey(now))!;
  const start=civilDay(student.start_date),end=civilDay(student.end_date);
  const deleted=student.status==='DELETED';
  return {active:!deleted&&!student.protocol_closed_at&&start!==null&&end!==null&&start<=today&&today<=end,
    daysLeft:end===null?null:end-today,daysSinceStart:start===null?null:today-start,
    dataIssue:start===null||end===null||end<start};
}

export const isActiveStudent=(student:StudentDates,now=new Date())=>studentValidity(student,now).active;
export const ACTIVE_STUDENT_DEFINITION='Phác đồ có ngày bắt đầu ≤ hôm nay ≤ ngày kết thúc (giờ Việt Nam), không tính hồ sơ đã xóa hoặc phác đồ đang đóng; bao gồm học viên sắp hết hạn.';
