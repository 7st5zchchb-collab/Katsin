import {passwordDigest} from './staff-session';

// Shared database counters, so separate Worker instances cannot bypass the limit.
export async function consumeRequestLimit(db:D1Database,scope:string,ip:string,maximum:number,seconds:number,now=Date.now()){
 const bucket=Math.floor(now/(seconds*1000)),prefix='request-limit:',expires=(bucket+1)*seconds*1000;
 const id=`${prefix}${scope}:${bucket}:${await passwordDigest(ip)}`;
 const row=await db.prepare("INSERT INTO settings(key,value) VALUES (?,json_object('attempts',1,'expires',?)) ON CONFLICT(key) DO UPDATE SET value=json_set(settings.value,'$.attempts',json_extract(settings.value,'$.attempts')+1) WHERE json_extract(settings.value,'$.attempts')<? RETURNING json_extract(value,'$.attempts') AS attempts").bind(id,expires,maximum).first<{attempts:number}>();
 // Bounded cleanup uses the primary-key range, not a scan over staff financial data.
 if(row?.attempts===1)await db.prepare("DELETE FROM settings WHERE key IN (SELECT key FROM settings WHERE key>=? AND key<? AND json_extract(value,'$.expires')<=? LIMIT 32)").bind(prefix,'request-limit;',now).run();
 return {allowed:!!row,retryAfter:Math.max(1,Math.ceil((expires-now)/1000))};
}
