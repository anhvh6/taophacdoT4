import {auth} from './auth';
export async function integrationAdmin(method:string,body?:unknown,path='keys') {
  const {data}=await auth.getSession();
  const token=data.session?.access_token;
  if(!token) throw new Error('Phiên đăng nhập đã hết hạn.');
  const response=await fetch('/api/v1/'+path,{method,
    headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>null);
  if(payload?.error?.code==='DISABLED') throw new Error('Máy chủ chưa bật tính năng Kết nối.');
  if(!response.ok||!payload?.success) throw new Error(payload?.error?.message||'Không thể thực hiện yêu cầu.');
  return payload.data;
}
