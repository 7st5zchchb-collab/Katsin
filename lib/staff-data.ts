import {env} from 'cloudflare:workers';
import {StaffIdentity,StaffMember} from './staff-roles';
import {passwordDigest,equalDigest,codeDigest} from './staff-session';
export const staffJson=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const trustedStaffRequest=(req:Request)=>req.headers.get('origin')===new URL(req.url).origin;
export function audit(who:StaffIdentity,action:string,entityType:string,entityId:string,subjectId:string|null,details:unknown,now=Date.now()){
 return env.DB!.prepare('INSERT INTO staff_activity (id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),who.id,who.name,action,entityType,entityId,subjectId,JSON.stringify(details),now);
}
export async function memberById(id:string){const r=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind('staff-member:'+id).first<{value:string}>();return r?JSON.parse(r.value) as StaffMember:null}
export async function verifyOwnCode(who:StaffIdentity,code:unknown){
 if(typeof code!=='string'||code.length>256)return false;
 if(who.id==='manager')return equalDigest(await passwordDigest(code),env.STAFF_PASSWORD_HASH||'');
 const m=await memberById(who.id);return !!m?.active&&equalDigest(await codeDigest(code.trim(),env.STAFF_SESSION_KEY!),m.codeHash);
}
export function validDay(day:unknown):day is string{if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(day+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===day}
export function yerevanDay(now=Date.now()){return new Date(now+4*3600000).toISOString().slice(0,10)}
export function monthBounds(month:string){const from=Date.parse(month+'-01T00:00:00+04:00');const [y,m]=month.split('-').map(Number);const next=new Date(Date.UTC(y,m,1)-4*3600000).getTime();return {from,to:next}}
