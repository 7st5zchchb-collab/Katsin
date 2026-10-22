import {env} from 'cloudflare:workers';
import {initializePendingRoster,initializeConfiguredCode} from '../../../../lib/staff-bootstrap';
import {createStaffSession,passwordDigest,equalDigest,staffCookie,sessionSeconds,codeDigest} from '../../../../lib/staff-session';
import {consumeRequestLimit} from '../../../../lib/request-rate';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
function trusted(req:Request){return req.headers.get('origin')===new URL(req.url).origin}
export async function POST(req:Request){
 if(!trusted(req))return json({error:'Անթույլատրելի հարցում։'},403);
 if(!env.STAFF_PASSWORD_HASH||!env.STAFF_SESSION_KEY||!env.DB)return json({error:'Աշխատակցի մուտքը դեռ կարգավորված չէ։'},503);
 try{
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 const rate=await consumeRequestLimit(env.DB,'staff-login',ip,10,900);
 if(!rate.allowed)return json({error:'Շատ փորձեր են կատարվել։ Փորձեք կրկին 15 րոպեից։'},429,{'Retry-After':String(rate.retryAfter)});
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
