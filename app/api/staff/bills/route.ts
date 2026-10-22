import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {canCash,StaffMember} from '../../../../lib/staff-roles';
import {staffJson as json,trustedStaffRequest,memberById,yerevanDay,validDay} from '../../../../lib/staff-data';
import {validateItems} from '../../../../lib/bills';
import {tables} from '../../../../lib/catalog';
export async function GET(req:Request){try{
 const who=await currentStaff();if(!who||!canCash(who.role))return json({error:'Մուտքը սահմանափակ է։'},403);
 const u=new URL(req.url),status=u.searchParams.get('status')||'open',day=u.searchParams.get('day')||yerevanDay();
 if(!['open','closed','void'].includes(status)||!validDay(day))return json({error:'Սխալ զտիչ։'},400);
 const clause=status==='open'?"status='open'":"status=? AND business_day=?",args=status==='open'?[]:[status,day];
 const count=await env.DB!.prepare('SELECT count(*) AS total FROM table_bills WHERE '+clause).bind(...args).first<{total:number}>();
 const pages=Math.max(1,Math.ceil((count?.total||0)/50)),page=Math.min(pages,Math.max(1,Math.floor(Number(u.searchParams.get('page')||1))||1));
 const rows=await env.DB!.prepare('SELECT * FROM table_bills WHERE '+clause+' ORDER BY opened_at DESC LIMIT 50 OFFSET ?').bind(...args,(page-1)*50).all();
 const active=await env.DB!.prepare("SELECT value FROM settings WHERE key LIKE 'staff-member:%' AND json_extract(value,'$.active')=1 AND json_extract(value,'$.role')='waiter'").all<{value:string}>();
 const stats=await env.DB!.prepare("SELECT coalesce(sum(total),0) AS total,coalesce(sum(cash),0) AS cash,coalesce(sum(card),0) AS card,count(*) AS count FROM table_bills WHERE status='closed' AND business_day=?").bind(day).first();
 return json({bills:rows.results,waiters:active.results.map(r=>{const m=JSON.parse(r.value) as StaffMember;return {id:m.id,name:m.name}}),stats,day,page,pages});
 }catch{return json({error:'Հաշիվները չհաջողվեց բեռնել։'},503)}}
export async function POST(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who||!canCash(who.role))return json({error:'Միայն գանձապահի կամ կառավարչի համար։'},403);
 const b=await req.json() as Record<string,unknown>;
 if(!tables.some(t=>t.id===b.tableId)||typeof b.waiterId!=='string')return json({error:'Ընտրեք սեղանը և մատուցողին։'},400);
 const waiter=await memberById(b.waiterId);if(!waiter?.active||waiter.role!=='waiter')return json({error:'Ընտրեք ակտիվ մատուցողի։'},400);
 const id=crypto.randomUUID(),now=Date.now();
 const row=await env.DB!.prepare("INSERT INTO table_bills(id,table_id,waiter_id,waiter_name,status,items,total,cash,card,opened_at,revision,actor_id,actor_name,updated_at,reason) VALUES (?,?,?,?,'open','[]',0,0,0,?,1,?,?,?,'') ON CONFLICT DO NOTHING RETURNING id").bind(id,b.tableId,waiter.id,waiter.name,now,who.id,who.name,now).first();
 return row?json({id},201):json({error:'Այս սեղանի համար արդեն բաց հաշիվ կա։'},409);
 }catch{return json({error:'Հաշիվը չհաջողվեց բացել։'},503)}
}
export async function PATCH(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who||!canCash(who.role))return json({error:'Մուտքը սահմանափակ է։'},403);
 const b=await req.json() as Record<string,unknown>,reason=typeof b.reason==='string'?b.reason.trim():'';
 if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||reason.length<3||reason.length>300||!['edit','close','void'].includes(String(b.action)))return json({error:'Նշեք գործողությունը և փոփոխության պատճառը։'},400);
 const old=await env.DB!.prepare('SELECT * FROM table_bills WHERE id=?').bind(b.id).first<{status:string,revision:number,total:number,items:string}>();
 if(!old)return json({error:'Հաշիվը չի գտնվել։'},404);
 if(old.revision!==b.revision)return json({error:'Հաշիվը փոխվել է։ Թարմացրեք և կրկին փորձեք։'},409);
 let result;
 const now=Date.now();
 if(b.action==='void'){
  if(old.status==='closed'&&!who.manager)return json({error:'Փակված հաշիվը կարող է ուղղել միայն կառավարիչը։'},403);
  result=await env.DB!.prepare("UPDATE table_bills SET status='void',business_day=coalesce(business_day,?),actor_id=?,actor_name=?,updated_at=?,reason=?,revision=revision+1 WHERE id=? AND revision=? AND status IN ('open','closed')").bind(yerevanDay(now),who.id,who.name,now,reason,b.id,b.revision).run();
 }else if(b.action==='edit'){
  const parsed=validateItems(b.items);if(!parsed||typeof b.waiterId!=='string')return json({error:'Ստուգեք ուտեստների անունները, քանակներն ու գները։'},400);
  const waiter=await memberById(b.waiterId);if(!waiter?.active||waiter.role!=='waiter')return json({error:'Ընտրեք ակտիվ մատուցողի։'},400);
  result=await env.DB!.prepare("UPDATE table_bills SET items=?,total=?,waiter_id=?,waiter_name=?,actor_id=?,actor_name=?,updated_at=?,reason=?,revision=revision+1 WHERE id=? AND revision=? AND status='open'").bind(JSON.stringify(parsed.items),parsed.total,waiter.id,waiter.name,who.id,who.name,now,reason,b.id,b.revision).run();
 }else{
  const cash=Number(b.cash),card=Number(b.card);
  if(!Number.isSafeInteger(b.cash)||!Number.isSafeInteger(b.card)||cash<0||card<0||cash+card!==old.total||old.total<=0)return json({error:'Կանխիկի և քարտի գումարները պետք է հավասար լինեն հաշվի ընդհանուր գումարին։'},400);
  result=await env.DB!.prepare("UPDATE table_bills SET status='closed',cash=?,card=?,closed_at=?,business_day=?,actor_id=?,actor_name=?,updated_at=?,reason=?,revision=revision+1 WHERE id=? AND revision=? AND status='open'").bind(cash,card,now,yerevanDay(now),who.id,who.name,now,reason,b.id,b.revision).run();
 }
 return result.meta.changes?json({ok:true}):json({error:'Հաշիվը փոխվել կամ փակվել է։ Թարմացրեք էջը։'},409);
 }catch{return json({error:'Փոփոխությունը չի պահպանվել։'},503)}
}
