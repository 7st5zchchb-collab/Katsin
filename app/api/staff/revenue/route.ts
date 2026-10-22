import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {staffJson as json,trustedStaffRequest,memberById,validDay,yerevanDay} from '../../../../lib/staff-data';
export async function POST(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who?.manager)return json({error:'Միայն կառավարչի համար։'},403);
 const b=await req.json() as Record<string,unknown>,reason=typeof b.reason==='string'?b.reason.trim():'';
 if(typeof b.staffId!=='string'||!validDay(b.day)||b.day>yerevanDay()||!Number.isSafeInteger(b.amount)||Number(b.amount)<0||Number(b.amount)>1_000_000_000_000||!Number.isSafeInteger(b.revision)||Number(b.revision)<0||reason.length>300||(Number(b.revision)>0&&reason.length<3))return json({error:'Նշեք ճիշտ օրը, ամբողջ գումարը դրամով և ուղղման պատճառը։'},400);
 const member=await memberById(b.staffId);if(!member||member.role!=='waiter')return json({error:'Գումարը կարելի է գրանցել միայն մատուցողի համար։'},400);
 // One authoritative daily total per waiter, with optimistic revision checks.
 const row=await env.DB!.prepare('INSERT INTO staff_revenue(id,staff_id,day,amount,updated_at,updated_by,updated_name,revision,reason) SELECT ?,?,?,?,?,?,?,1,? WHERE ?=0 ON CONFLICT(staff_id,day) DO UPDATE SET amount=excluded.amount,updated_at=excluded.updated_at,updated_by=excluded.updated_by,updated_name=excluded.updated_name,revision=staff_revenue.revision+1,reason=excluded.reason WHERE staff_revenue.revision=? RETURNING id').bind(crypto.randomUUID(),b.staffId,b.day,b.amount,Date.now(),who.id,who.name,reason,b.revision,b.revision).first<{id:string}>();
 // Existing rows need an UPDATE when a revision is supplied (no INSERT SELECT row).
 if(!row&&Number(b.revision)>0){
 const updated=await env.DB!.prepare('UPDATE staff_revenue SET amount=?,updated_at=?,updated_by=?,updated_name=?,revision=revision+1,reason=? WHERE staff_id=? AND day=? AND revision=? RETURNING id').bind(b.amount,Date.now(),who.id,who.name,reason,b.staffId,b.day,b.revision).first<{id:string}>();
 if(updated)return json({ok:true});
 }
 return row?json({ok:true}):json({error:'Գումարի գրառումն արդեն փոխվել է։ Թարմացրեք էջը և կրկին փորձեք։'},409);
 }catch{return json({error:'Գումարը չհաջողվեց պահպանել։'},503)}
}
