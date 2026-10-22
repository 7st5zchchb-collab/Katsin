import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {staffCookie,validStaffSession} from '../lib/staff-session';
import {isManager,canBook,validRole,StaffMember,StaffIdentity} from '../lib/staff-roles';
export type {StaffMember} from '../lib/staff-roles';
export async function currentStaff():Promise<StaffIdentity|null>{
 const token=(await cookies()).get(staffCookie)?.value;
 if(!await validStaffSession(token,env.STAFF_SESSION_KEY))return null;
 const parts=token!.split('.'),id=parts.length===3?'manager':parts[2];
 if(id==='manager'){if(Number(parts[0])-8*60*60*1000<Number(env.STAFF_MANAGER_REVOKED_BEFORE||0))return null;return {id,name:env.STAFF_MANAGER_NAME||'Գլխավոր կառավարիչ',role:'manager',manager:true};}
 const row=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind('staff-member:'+id).first<{value:string}>();
 if(!row)return null;const m=JSON.parse(row.value) as StaffMember;
 if(!m.active||Number(parts[0])-8*60*60*1000<(m.revokedBefore||0))return null;
 const role=validRole(m.role)?m.role:'host';
 return {id:m.id,name:m.name,role,manager:isManager(role),scheduleGroups:Array.isArray(m.scheduleGroups)?m.scheduleGroups.filter(g=>g==='assistant'||g==='waiter'):[]};
}
export async function hasStaffAccess(){const who=await currentStaff();return !!who&&canBook(who.role)}
