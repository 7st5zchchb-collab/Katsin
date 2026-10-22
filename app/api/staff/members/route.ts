import {env} from 'cloudflare:workers';
import {initializePendingRoster} from '../../../../lib/staff-bootstrap';
import {currentStaff} from '../../../staff-auth';
import {codeDigest,passwordDigest,equalDigest} from '../../../../lib/staff-session';
import {StaffMember,validRole} from '../../../../lib/staff-roles';
import {staffJson as json,trustedStaffRequest,audit,memberById} from '../../../../lib/staff-data';
export async function GET(req?:Request){try{const who=await currentStaff();if(!who?.manager)return json({error:'Միայն կառավարչի համար։'},403);await initializePendingRoster(who.name,who.id);const role=req?new URL(req.url).searchParams.get('role'):null;if(role&&!validRole(role))return json({error:'Սխալ դեր։'},400);const r=await env.DB!.prepare(role?"SELECT value FROM settings WHERE key LIKE 'staff-member:%' AND json_extract(value,'$.role')=? ORDER BY json_extract(value,'$.name')":"SELECT value FROM settings WHERE key LIKE 'staff-member:%' ORDER BY json_extract(value,'$.name')");const rows=await (role?r.bind(role):r).all<{value:string}>();return json({members:rows.results.map(r=>{const m=JSON.parse(r.value) as StaffMember;return {id:m.id,name:m.name,active:m.active,role:m.role||'host',createdAt:m.createdAt,firstName:m.firstName||'',lastName:m.lastName||'',jobTitle:m.jobTitle||'',scheduleGroups:m.scheduleGroups||[]}})});}catch{return json({error:'Չհաջողվեց բեռնել աշխատակիցներին։'},503)}}
async function availableCode(requested:unknown){
 for(let attempt=0;attempt<20;attempt++){
 const code=requested===undefined||requested===''?String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,'0'):requested;
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
 const hash=await codeDigest(code,env.STAFF_SESSION_KEY!),exists=await env.DB!.prepare('SELECT key FROM settings WHERE key=?').bind('staff-code:'+hash).first();
 if(!exists&&!equalDigest(await passwordDigest(code),env.STAFF_PASSWORD_HASH||''))return code;
 if(requested!==undefined&&requested!=='')return null;
 }return null;
}
export async function POST(req:Request){
 if(!trustedStaffRequest(req))return json({error:'Անթույլատրելի հարցում։'},403);
 try{
 const who=await currentStaff();if(!who?.manager)return json({error:'Միայն կառավարչի համար։'},403);
 const body=await req.json() as Record<string,unknown>,now=Date.now();
 const firstName=typeof body.firstName==='string'?body.firstName.trim():'',lastName=typeof body.lastName==='string'?body.lastName.trim():'',jobTitle=typeof body.jobTitle==='string'?body.jobTitle.trim():'';
 if(firstName.length>40||lastName.length>40||jobTitle.length>80)return json({error:'Ստուգեք աշխատակցի տվյալները։'},400);
 if(['disable','update','rotate'].includes(String(body.action))){
  if(typeof body.id!=='string')return json({error:'Սխալ աշխատակից։'},400);
  const m=await memberById(body.id);if(!m)return json({error:'Աշխատակիցը չի գտնվել։'},404);
  if(m.id===who.id&&body.action==='disable')return json({error:'Ձեր սեփական մուտքն անջատել հնարավոր չէ։'},400);
  const before={name:m.name,role:m.role||'host',active:m.active,scheduleGroups:m.scheduleGroups||[]};let code:string|undefined;const ops:D1PreparedStatement[]=[];
  if(body.action==='disable'){m.active=false;m.revokedBefore=now;ops.push(env.DB!.prepare('DELETE FROM settings WHERE key=?').bind('staff-code:'+m.codeHash))}
  if(body.action==='update'){
   const name=firstName?[firstName,lastName].filter(Boolean).join(' '):typeof body.name==='string'?body.name.trim():'';if(name.length<2||name.length>80||!validRole(body.role))return json({error:'Ստուգեք անունը և աշխատակցի դերը։'},400);
   m.name=name;m.role=body.role;m.scheduleGroups=Array.isArray(body.scheduleGroups)?body.scheduleGroups.filter(g=>g==='assistant'||g==='waiter'):m.scheduleGroups||[];m.firstName=firstName;m.lastName=lastName;m.jobTitle=jobTitle;
  }
  if(body.action==='rotate'){
   code=await availableCode(body.code)||undefined;if(!code)return json({error:'Կոդը պետք է լինի 6 թվանշան և չկրկնվի։'},409);const old=m.codeHash;m.codeHash=await codeDigest(code,env.STAFF_SESSION_KEY!);m.active=true;m.revokedBefore=now;
   ops.push(env.DB!.prepare('DELETE FROM settings WHERE key=?').bind('staff-code:'+old),env.DB!.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('staff-code:'+m.codeHash,m.id));
  }
  ops.push(env.DB!.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(m),'staff-member:'+m.id),audit(who,'member.'+body.action,'member',m.id,m.id,{before,after:{name:m.name,role:m.role||'host',active:m.active,scheduleGroups:m.scheduleGroups||[]}},now));
  await env.DB!.batch(ops);return json({ok:true,...(code?{code,name:m.name}: {})});
 }
 const name=firstName?[firstName,lastName].filter(Boolean).join(' '):typeof body.name==='string'?body.name.trim():'';const role=body.role===undefined?'host':body.role;
 if(name.length<2||name.length>80||!validRole(role))return json({error:'Ստուգեք անունը և աշխատակցի դերը։'},400);
 const id=crypto.randomUUID();
 if(body.withoutCode===true){const m:StaffMember={id,name,firstName,lastName,jobTitle,role,active:false,codeHash:'',scheduleGroups:Array.isArray(body.scheduleGroups)?body.scheduleGroups.filter(g=>g==='assistant'||g==='waiter'):[],createdAt:now};await env.DB!.batch([env.DB!.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('staff-member:'+id,JSON.stringify(m)),audit(who,'member.create','member',id,id,{name,role,active:false},now)]);return json({id,name,role,active:false},201);}
 const code=await availableCode(body.code);if(!code)return json({error:'Կոդը պետք է լինի 6 թվանշան և չկրկնվի։'},409);const codeHash=await codeDigest(code,env.STAFF_SESSION_KEY!);
 const m:StaffMember={id,name,firstName,lastName,jobTitle,role,scheduleGroups:Array.isArray(body.scheduleGroups)?body.scheduleGroups.filter(g=>g==='assistant'||g==='waiter'):[],active:true,codeHash,createdAt:now};
 await env.DB!.batch([env.DB!.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('staff-member:'+id,JSON.stringify(m)),env.DB!.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('staff-code:'+codeHash,id),audit(who,'member.create','member',id,id,{name,role},now)]);
 return json({id,name,role,code},201);
 }catch{return json({error:'Փոփոխությունը չի պահպանվել։'},503)}
}
