import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {staffJson as json,trustedStaffRequest,verifyOwnCode} from '../../../../lib/staff-data';
export async function POST(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who)return json({error:'Մուտքն անհրաժեշտ է։'},403);
 const b=await req.json() as Record<string,unknown>;
 if(!['start','end'].includes(String(b.action)))return json({error:'Սխալ գործողություն։'},400);
 // Repeated code attempts are limited separately from ordinary authenticated actions.
 const now=Date.now(),rateKey=`staff-punch:${Math.floor(now/900000)}:${who.id}`;
 const rate=await env.DB!.prepare("INSERT INTO settings(key,value) VALUES (?,json_object('attempts',1,'expires',?)) ON CONFLICT(key) DO UPDATE SET value=json_set(settings.value,'$.attempts',json_extract(settings.value,'$.attempts')+1) RETURNING json_extract(value,'$.attempts') AS attempts").bind(rateKey,now+900000).first<{attempts:number}>();
 if(!rate||rate.attempts>20)return json({error:'Շատ փորձեր են կատարվել։ Փորձեք կրկին 15 րոպեից։'},429);
 if(!await verifyOwnCode(who,b.code))return json({error:'Մուտքագրեք ձեր անհատական կոդը։'},401);
 let row:{id:string}|null;
 if(b.action==='start'){
 row=await env.DB!.prepare('INSERT INTO staff_shifts(id,staff_id,started_at,ended_at,updated_at,actor_id,actor_name) VALUES (?,?,?,NULL,?,?,?) ON CONFLICT DO NOTHING RETURNING id').bind(crypto.randomUUID(),who.id,now,now,who.id,who.name).first<{id:string}>();
 }else{
 row=await env.DB!.prepare("UPDATE staff_shifts SET ended_at=?,updated_at=?,actor_id=?,actor_name=?,reason='' WHERE staff_id=? AND ended_at IS NULL RETURNING id").bind(now,now,who.id,who.name,who.id).first<{id:string}>();
 }
 // Shift activity is written by database triggers in the same transaction.
 if(!row)return json({error:b.action==='start'?'Ձեր հերթափոխն արդեն սկսված է։':'Սկսված հերթափոխ չկա։'},409);
 return json({ok:true,id:row.id});
 }catch{return json({error:'Հերթափոխը չհաջողվեց պահպանել։'},503)}
}
export async function PATCH(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who?.manager)return json({error:'Միայն կառավարչի համար։'},403);
 const b=await req.json() as Record<string,unknown>,start=Number(b.startedAt),end=b.endedAt===null?null:Number(b.endedAt),reason=typeof b.reason==='string'?b.reason.trim():'';
 if(typeof b.id!=='string'||!Number.isSafeInteger(start)||start<=0||start>Date.now()||(end!==null&&(!Number.isSafeInteger(end)||end<=start||end>Date.now()))||reason.length<3||reason.length>300||!Number.isSafeInteger(b.revision))return json({error:'Ստուգեք ժամերը և նշեք փոփոխության պատճառը։'},400);
 const old=await env.DB!.prepare('SELECT * FROM staff_shifts WHERE id=?').bind(b.id).first<{id:string,staff_id:string,started_at:number,ended_at:number|null,updated_at:number}>();if(!old)return json({error:'Հերթափոխը չի գտնվել։'},404);
 const updated=Math.max(Date.now(),old.updated_at+1);
 // Revision and overlap checks happen in the same UPDATE, preventing stale manager edits.
 const r=await env.DB!.batch([
 env.DB!.prepare('UPDATE staff_shifts SET started_at=?,ended_at=?,updated_at=?,actor_id=?,actor_name=?,reason=? WHERE id=? AND updated_at=? AND NOT EXISTS(SELECT 1 FROM staff_shifts other WHERE other.staff_id=staff_shifts.staff_id AND other.id!=staff_shifts.id AND other.started_at<coalesce(?,9223372036854775807) AND coalesce(other.ended_at,9223372036854775807)>?)').bind(start,end,updated,who.id,who.name,reason,b.id,b.revision,end,start),
 ]);
 if(!r[0].meta.changes)return json({error:'Հերթափոխը փոխվել է կամ ժամերը համընկնում են այլ հերթափոխի հետ։ Թարմացրեք էջը։'},409);
 return json({ok:true});
 }catch{return json({error:'Հերթափոխը չհաջողվեց պահպանել։'},503)}
}
