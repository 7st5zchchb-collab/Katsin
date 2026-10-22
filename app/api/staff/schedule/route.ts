import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {StaffMember} from '../../../../lib/staff-roles';
import {staffJson as json,trustedStaffRequest} from '../../../../lib/staff-data';
import {canEditSchedule,canViewSchedule,mondayFor,validWeek,visibleSnapshot,validateEntries,WeeklySchedule,validGroup,ScheduleGroup} from '../../../../lib/schedule';
const empty=():WeeklySchedule=>({revision:0,draft:{},published:null,scheduled:null,updatedAt:0,updatedBy:''});
async function roster(group:ScheduleGroup){const r=await env.DB!.prepare("SELECT value FROM settings WHERE key LIKE 'staff-member:%' AND json_extract(value,'$.role')=? ORDER BY json_extract(value,'$.name')").bind(group).all<{value:string}>();return r.results.map(r=>{const m=JSON.parse(r.value) as StaffMember;return {id:m.id,name:m.name,active:m.active}})}
export async function GET(req:Request){try{
 const who=await currentStaff(),u=new URL(req.url),group=u.searchParams.get('group')||'assistant';if(!validGroup(group))return json({error:'Սխալ բաժին։'},400);if(!who||!canViewSchedule(who,group))return json({error:'Մուտքը սահմանափակ է։'},403);
 const week=u.searchParams.get('week')||mondayFor();if(!validWeek(week))return json({error:'Ընտրեք շաբաթվա երկուշաբթի օրը։'},400);
 const r=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind('staff-schedule:'+group+':'+week).first<{value:string}>();
 const s=r?JSON.parse(r.value) as WeeklySchedule:empty(),visible=visibleSnapshot(s,Date.now()),editable=canEditSchedule(who,group);
 let futureEntries:Record<string,Record<string,unknown>>={};{const rows=await env.DB!.prepare("SELECT key,value FROM settings WHERE key LIKE ? AND key>? ORDER BY key LIMIT 14").bind('staff-schedule:'+group+':%','staff-schedule:'+group+':'+week).all<{key:string,value:string}>();for(const row of rows.results){const snap=visibleSnapshot(JSON.parse(row.value) as WeeklySchedule,Date.now());if(snap)for(const [id,days] of Object.entries(snap.entries))futureEntries[id]={...futureEntries[id],...days};}}
 return json({week,group,roster:await roster(group),canEdit:editable,published:visible,futureEntries,...(editable?{revision:s.revision,draft:s.draft,scheduled:s.scheduled&&s.scheduled.publishAt!>Date.now()?s.scheduled:null,updatedAt:s.updatedAt,updatedBy:s.updatedBy}:{})});
 }catch{return json({error:'Գրաֆիկը չհաջողվեց բեռնել։'},503)}}
export async function POST(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who)return json({error:'Մուտքը սահմանափակ է։'},403);
 const b=await req.json() as Record<string,unknown>,group=b.group;if(!validGroup(group)||!canEditSchedule(who,group))return json({error:'Գրաֆիկը կազմելու իրավունք չունեք։'},403);
 if(!validWeek(b.week)||!Number.isSafeInteger(b.revision)||Number(b.revision)<0||!['draft','publish','schedule','unschedule'].includes(String(b.action)))return json({error:'Ստուգեք շաբաթն ու գործողությունը։'},400);
 const key='staff-schedule:'+group+':'+b.week,row=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>(),old=row?JSON.parse(row.value) as WeeklySchedule:empty();
 if(old.revision!==b.revision)return json({error:'Գրաֆիկը փոխվել է։ Թարմացրեք էջը՝ փոփոխությունները տեսնելու համար։'},409);
 const now=Date.now(),currentWeek=mondayFor();if(b.week<currentWeek)return json({error:'Անցած շաբաթների գրաֆիկները միայն դիտելու համար են։'},400);
 const people=await roster(group),ids=people.map(m=>m.id),entries=b.action==='unschedule'?old.draft:validateEntries(b.entries,ids,b.week,b.action!=='draft',group);
 if(!entries)return json({error:'Լրացրեք բոլոր աշխատակիցների 7 օրերը՝ հերթափոխով կամ հանգստյան օրով։'},400);
 const s:WeeklySchedule={...old,revision:old.revision+1,updatedAt:now,updatedBy:who.name,published:visibleSnapshot(old,now),scheduled:old.scheduled&&old.scheduled.publishAt!>now?old.scheduled:null};
 if(b.action==='draft')s.draft=entries;
 if(b.action==='publish'){s.draft=entries;s.published={entries,roster:people,at:now,by:who.name};s.scheduled=null}
 if(b.action==='schedule'){
  const publishAt=Number(b.publishAt);if(!Number.isSafeInteger(publishAt)||publishAt<=now||publishAt>now+90*86400000)return json({error:'Ընտրեք հրապարակման ապագա օրն ու ժամը։'},400);
  s.draft=entries;s.scheduled={entries,roster:people,at:now,by:who.name,publishAt};
 }
 if(b.action==='unschedule')s.scheduled=null;
 const mutation=crypto.randomUUID();s.mutation=mutation;
 // Compare-and-set plus a unique write marker ensures only the winning mutation is audited.
 const write=row?env.DB!.prepare("UPDATE settings SET value=? WHERE key=? AND json_extract(value,'$.revision')=?").bind(JSON.stringify(s),key,b.revision):env.DB!.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind(key,JSON.stringify(s));
 const results=await env.DB!.batch([write,env.DB!.prepare("INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) SELECT ?,?,?,?,'schedule',?,NULL,?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?)").bind(mutation,who.id,who.name,'schedule.'+b.action,group+':'+b.week,JSON.stringify({group,week:b.week,publishAt:s.scheduled?.publishAt||null,entries}),now,key,JSON.stringify(s))]);
 return results[0].meta.changes?json({ok:true,revision:s.revision}):json({error:'Գրաֆիկը փոխվել է։ Թարմացրեք էջը՝ փոփոխությունները տեսնելու համար։'},409);
 }catch{return json({error:'Գրաֆիկը չհաջողվեց պահպանել։ Թարմացրեք էջը և փորձեք կրկին։'},503)}
}
