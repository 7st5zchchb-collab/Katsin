import { env } from 'cloudflare:workers';
import { hasStaffAccess, currentStaff } from '../../staff-auth';
import { tables } from '../../../lib/catalog';
import { validWindow } from '../../../lib/booking';
import {consumeRequestLimit} from '../../../lib/request-rate';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export async function GET(req:Request){
 try{
 const url=new URL(req.url);
 if(url.searchParams.get('staff')==='1'){
  if(!await hasStaffAccess())return json({error:'Մուտքը սահմանափակ է։'},403);
  const q=url.searchParams.get('q')?.trim().slice(0,100)||'',date=url.searchParams.get('date')||'',time=url.searchParams.get('time')||'',table=url.searchParams.get('table')||'',status=url.searchParams.get('status')||'all',scope=url.searchParams.get('scope')||'all';
  const where:string[]=[],args:(string|number)[]=[];
  if(q){const lower=q.toLowerCase(),title=lower.replace(/(^|\s)\S/gu,c=>c.toUpperCase());where.push('(instr(lower(name),lower(?))>0 OR instr(name,?)>0 OR instr(name,?)>0 OR instr(name,?)>0 OR instr(phone,?)>0 OR instr(id,?)>0)');args.push(q,lower,title,q.toUpperCase(),q,q)}
  if(date){const start=Date.parse(date+'T00:00:00+04:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(start))return json({error:'Սխալ ամսաթիվ։'},400);where.push('start>=? AND start<?');args.push(start,start+86400000)}
  if(time){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return json({error:'Սխալ ժամ։'},400);where.push("strftime('%H:%M',start/1000,'unixepoch','+4 hours')=?");args.push(time)}
  if(table){if(table!=='any'&&!tables.some(t=>t.id===table))return json({error:'Սխալ սեղան։'},400);where.push('table_id=?');args.push(table)}
  if(status!=='all'){if(!['pending','confirmed','rejected','cancelled'].includes(status))return json({error:'Սխալ կարգավիճակ։'},400);where.push('status=?');args.push(status)}
  if(scope==='history'){where.push("(end<=? OR status IN ('rejected','cancelled'))");args.push(Date.now())}
  if(scope==='active'){where.push("end>? AND status IN ('pending','confirmed')");args.push(Date.now())}
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  const counts=await env.DB!.prepare('SELECT count(*) AS total,coalesce(sum(status=\'pending\'),0) AS pending,coalesce(sum(status=\'confirmed\'),0) AS confirmed FROM reservations'+clause).bind(...args).first<{total:number,pending:number,confirmed:number}>();
  const pages=Math.max(1,Math.ceil((counts?.total||0)/50)),requested=Number(url.searchParams.get('page')||1),page=Number.isSafeInteger(requested)?Math.min(pages,Math.max(1,requested)):1;
  const rows=await env.DB!.prepare('SELECT * FROM reservations'+clause+' ORDER BY start DESC,id DESC LIMIT 50 OFFSET ?').bind(...args,(page-1)*50).all();return json({reservations:rows.results,total:counts?.total||0,pages,page,counts});
 }
 const start=Number(url.searchParams.get('start')),end=Number(url.searchParams.get('end'));
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>21600000)return json({error:'Ընտրեք ամսաթիվն ու ժամը։'},400);
 const rows=await env.DB!.prepare("SELECT table_id,status FROM reservations WHERE table_id != 'any' AND status IN ('pending','confirmed') AND start < ? AND end > ?").bind(end,start).all();return json({busy:rows.results});
 }catch{return json({error:'Տվյալները չհաջողվեց բեռնել։ Փորձեք կրկին։'},503);}
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const actor=await currentStaff();
 if(!actor){
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  for(const [scope,maximum,seconds] of [['booking-short',5,900],['booking-day',20,86400]] as const){
   const limit=await consumeRequestLimit(env.DB!,scope,ip,maximum,seconds);
   if(!limit.allowed)return Response.json({error:'Շատ հայտեր են ուղարկվել։ Փորձեք ավելի ուշ կամ զանգահարեք մեզ։'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(limit.retryAfter)}});
  }
 }
 const b=await req.json() as Record<string,unknown>;
 const any=b.tableId==='any',table=tables.find(t=>t.id===b.tableId);const start=Number(b.start),end=Number(b.end),guests=Number(b.guests);
 const name=String(b.name||'').trim(),phone=String(b.phone||'').replace(/[\s()-]/g,''),occasion=String(b.occasion||'').trim(),message=String(b.note||'').trim();
 if((!any&&!table)||!validWindow(start,end)||!Number.isInteger(guests)||guests<1||guests>(any?50:table!.capacity)||name.length<3||name.length>100||!/^\+?[0-9]{8,15}$/.test(phone)||message.length>1000||occasion.length>100)return json({error:'Ստուգեք անունը, հեռախոսահամարը, ժամը և հյուրերի քանակը։'},400);
 const confirmed=b.status==='confirmed';
 if(confirmed&&(!await hasStaffAccess()||any))return json({error:'Հաստատելու համար ընտրեք սեղան և մուտք գործեք կառավարչի հաշվով։'},403);
 const id=crypto.randomUUID(),tableId=any?'any':table!.id,status=confirmed?'confirmed':'pending',note=[any?'Ընտրություն՝ ցանկացած սեղան · անվճար (0 ֏)։ Սեղանը տրամադրում է աշխատակիցը։':`Ընտրություն՝ կոնկրետ սեղան №${table!.number} · 20 000 ֏։ Վճարման պայմանները՝ զանգով։`,occasion?'Առիթ՝ '+occasion:'',message].filter(Boolean).join('\n');
 const r=await env.DB!.prepare("INSERT INTO reservations (id,table_id,start,end,guests,name,phone,note,status,created_at,actor_id,actor_name,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?='any' OR NOT EXISTS (SELECT 1 FROM reservations WHERE table_id=? AND status IN ('pending','confirmed') AND start < ? AND end > ?)").bind(id,tableId,start,end,guests,name,phone,note,status,Date.now(),actor?.id||null,actor?.name||null,Date.now(),tableId,tableId,end,start).run();
 if(!r.meta.changes)return json({error:'Այս ժամին սեղանն արդեն զբաղված է։ Ընտրեք այլ ժամ կամ սեղան։'},409);
 return json({id,status},201);
 }catch{return json({error:'Հայտը չի ուղարկվել։ Փորձեք կրկին կամ զանգահարեք մեզ։'},503);}
}
export async function PATCH(req:Request){
 if(!sameOrigin(req)||!await hasStaffAccess())return json({error:'Մուտքն անհրաժեշտ է։'},403);
 try{
 const actor=await currentStaff();
 const b=await req.json() as {id:string,status:string,tableId?:string};
 if(!['confirmed','rejected','cancelled'].includes(b.status))return json({error:'Սխալ կարգավիճակ։'},400);
 let r;
 if(b.status==='confirmed'){
 const row=await env.DB!.prepare('SELECT * FROM reservations WHERE id=?').bind(b.id).first<{table_id:string,guests:number}>();
 if(!row)return json({error:'Հայտը չի գտնվել։'},404);
 const target=tables.find(t=>t.id===(b.tableId||row.table_id));
 if(!target||target.capacity<row.guests)return json({error:'Ընտրեք հյուրերի քանակին համապատասխան սեղան։'},400);
 r=await env.DB!.prepare("UPDATE reservations SET status='confirmed',table_id=?,actor_id=?,actor_name=?,updated_at=? WHERE id=? AND status='pending' AND NOT EXISTS (SELECT 1 FROM reservations other WHERE other.id != ? AND other.table_id=? AND other.status IN ('pending','confirmed') AND other.start < reservations.end AND other.end > reservations.start)").bind(target.id,actor!.id,actor!.name,Date.now(),b.id,b.id,target.id).run();
 }else{
 r=await env.DB!.prepare("UPDATE reservations SET status=?,actor_id=?,actor_name=?,updated_at=? WHERE id=? AND ((status='pending' AND ? IN ('rejected','cancelled')) OR (status='confirmed' AND ?='cancelled'))").bind(b.status,actor!.id,actor!.name,Date.now(),b.id,b.status,b.status).run();
 }
 return r.meta.changes?json({ok:true}):json({error:'Սեղանն արդեն զբաղված է կամ հայտի կարգավիճակը փոխվել է։ Թարմացրեք ցանկը։'},409);
 }catch{return json({error:'Փոփոխությունը չի պահպանվել։'},503);}
}
