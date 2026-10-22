import {env} from 'cloudflare:workers';
import {initializePendingRoster,initializeConfiguredCode} from '../../../../lib/staff-bootstrap';
import {createStaffSession,passwordDigest,equalDigest,staffCookie,sessionSeconds,codeDigest} from '../../../../lib/staff-session';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
function trusted(req:Request){return req.headers.get('origin')===new URL(req.url).origin}
export async function POST(req:Request){
 if(!trusted(req))return json({error:'Անթույլատրելի հարցում։'},403);
 if(!env.STAFF_PASSWORD_HASH||!env.STAFF_SESSION_KEY||!env.DB)return json({error:'Աշխատակցի մուտքը դեռ կարգավորված չէ։'},503);
 try{
 const now=Date.now(),ip=req.headers.get('cf-connecting-ip')||'unknown';
 const digest=await passwordDigest(ip),bucket=Math.floor(now/900000),rateKey=`staff-login:${bucket}:${digest}`;
 await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'staff-login:%' AND json_extract(value,'$.expires') < ?").bind(now).run();
 const rate=await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,json_object('attempts',1,'expires',?)) ON CONFLICT(key) DO UPDATE SET value=json_set(settings.value,'$.attempts',json_extract(settings.value,'$.attempts')+1) RETURNING json_extract(value,'$.attempts') AS attempts").bind(rateKey,(bucket+1)*900000).first<{attempts:number}>();
 if(!rate||rate.attempts>10)return json({error:'Շատ փորձեր են կատարվել։ Փորձեք կրկին 15 րոպեից։'},429,{'Retry-After':'900'});
 const body=await req.json() as {password?:unknown};
 if(typeof body.password!=='string'||body.password.length>256)return json({error:'Մուտքի կոդը սխալ է։'},401);
 let identity='manager';
 if(!equalDigest(await passwordDigest(body.password),env.STAFF_PASSWORD_HASH)){
  await initializeConfiguredCode(body.password.trim());
  const hash=await codeDigest(body.password.trim(),env.STAFF_SESSION_KEY);
  const row=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('staff-code:'+hash).first<{value:string}>();
  const member=row?await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('staff-member:'+row.value).first<{value:string}>():null;
  if(!member||!JSON.parse(member.value).active)return json({error:'Մուտքի կոդը սխալ է կամ անջատված է։'},401);
  identity=JSON.parse(member.value).id;
 }
 if(identity==='manager')await initializePendingRoster(env.STAFF_MANAGER_NAME||'Manager');
 const token=await createStaffSession(env.STAFF_SESSION_KEY,Date.now(),identity);
 return json({ok:true},200,{'Set-Cookie':`${staffCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionSeconds}`});
 }catch{return json({error:'Մուտքը չհաջողվեց։ Փորձեք կրկին։'},503)}
}
export async function DELETE(req:Request){
 if(!trusted(req))return json({error:'Անթույլատրելի հարցում։'},403);
 return json({ok:true},200,{'Set-Cookie':`${staffCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
}
