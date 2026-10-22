import {env} from 'cloudflare:workers';
import {validRole,roleLabels,StaffRole} from './staff-roles';
import {codeDigest,passwordDigest,equalDigest} from './staff-session';
// Runtime-only roster; never put staff codes or live staff data in source control.
export async function initializePendingRoster(actorName:string,actorId='manager'){
 const raw=(env as unknown as {STAFF_INITIAL_ROSTER?:string}).STAFF_INITIAL_ROSTER;if(!raw)return;
 const people=JSON.parse(raw) as {id:string,firstName:string,lastName:string,role:StaffRole,scheduleGroups:('assistant'|'waiter')[]}[];
 if(!Array.isArray(people)||people.length>100)throw Error('Invalid initial roster');
 const rosterKey='staff-roster-applied:'+await passwordDigest(raw);
 if(await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind(rosterKey).first())return;
 const now=Date.now(),ops:D1PreparedStatement[]=[];
 for(const p of people){if(!/^[-a-z0-9]{8,80}$/.test(p.id)||typeof p.firstName!=='string'||typeof p.lastName!=='string'||!validRole(p.role)||!Array.isArray(p.scheduleGroups)||p.scheduleGroups.some(g=>!['assistant','waiter'].includes(g)))throw Error('Invalid initial roster');
 const name=[p.firstName,p.lastName].filter(Boolean).join(' '),key='staff-member:'+p.id;
 ops.push(env.DB!.prepare("INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) SELECT ?,?,?,'member.create','member',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key=?)").bind(crypto.randomUUID(),actorId,actorName,p.id,p.id,JSON.stringify({name,role:p.role,active:false,source:'initial-roster'}),now,key));
 ops.push(env.DB!.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind(key,JSON.stringify({...p,name,jobTitle:roleLabels[p.role],active:false,codeHash:'',createdAt:now})));
 }ops.push(env.DB!.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind(rosterKey,String(now)));
 await env.DB!.batch(ops);
}

// One-time code assignment from deployment secrets, applied only on the matching login.
export async function initializeConfiguredCode(password:string){
 const raw=(env as unknown as {STAFF_INITIAL_CODES?:string}).STAFF_INITIAL_CODES;if(!raw)return;
 const config=JSON.parse(raw) as Record<string,string>;const entry=Object.entries(config).find(([,code])=>code===password);if(!entry)return;
 const [id,code]=entry;if(!/^[-a-z0-9]{8,80}$/.test(id)||!/^\d{6}$/.test(code))throw Error('Invalid initial code');
 await initializePendingRoster('System','system');
 const marker='staff-initial-code-applied:'+id;if(await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind(marker).first())return;
 const row=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind('staff-member:'+id).first<{value:string}>();if(!row)return;
 const member=JSON.parse(row.value); // The configured one-time assignment is an explicit credential change.
 if(equalDigest(await passwordDigest(code),env.STAFF_PASSWORD_HASH||''))throw Error('Code already used');
 const hash=await codeDigest(code,env.STAFF_SESSION_KEY!),codeKey='staff-code:'+hash,owner=await env.DB!.prepare('SELECT value FROM settings WHERE key=?').bind(codeKey).first<{value:string}>();if(owner&&owner.value!==id)throw Error('Code already used');
 const now=Date.now(),value=JSON.stringify({...member,active:true,codeHash:hash,revokedBefore:now}),memberKey='staff-member:'+id;
 await env.DB!.batch([
 env.DB!.prepare('INSERT OR IGNORE INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) AND NOT EXISTS(SELECT 1 FROM settings WHERE key=?)').bind(codeKey,id,memberKey,row.value,marker),
 env.DB!.prepare('UPDATE settings SET value=? WHERE key=? AND value=? AND EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) AND NOT EXISTS(SELECT 1 FROM settings WHERE key=?)').bind(value,memberKey,row.value,codeKey,id,marker),
 ...(member.codeHash&&member.codeHash!==hash?[env.DB!.prepare('DELETE FROM settings WHERE key=? AND value=? AND EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) AND NOT EXISTS(SELECT 1 FROM settings WHERE key=?)').bind('staff-code:'+member.codeHash,id,memberKey,value,marker)]:[]),
 env.DB!.prepare("INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) SELECT ?,'system','System','member.rotate','member',?,?,?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) AND NOT EXISTS(SELECT 1 FROM settings WHERE key=?)").bind(crypto.randomUUID(),id,id,JSON.stringify({name:member.name,source:'initial-code',active:true}),now,memberKey,value,marker),
 env.DB!.prepare('INSERT OR IGNORE INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?)').bind(marker,String(now),memberKey,value)
 ]);
}
