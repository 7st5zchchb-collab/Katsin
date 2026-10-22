const encoder=new TextEncoder();
export const staffCookie='__Host-katsin_staff';
export const sessionSeconds=8*60*60;
const validIdentity=(id:string)=>id==='manager'||/^[a-z0-9][a-z0-9-]{7,79}$/.test(id);
const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
export async function passwordDigest(password:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(password)))}
export function equalDigest(a:string,b:string){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0}
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function createStaffSession(secret:string,now=Date.now(),identity='manager'){
 if(!validIdentity(identity))throw Error('Invalid staff identity');
 const payload=`${now+sessionSeconds*1000}.${crypto.randomUUID()}.${identity}`;
 return payload+'.'+hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload)));
}
export async function validStaffSession(token:string|undefined,secret:string|undefined,now=Date.now()){
 if(!token||!secret)return false;
 const parts=token.split('.');if(![3,4].includes(parts.length)||!/^\d{13}$/.test(parts[0])||!/^[0-9a-f-]{36}$/.test(parts[1])||!/^[0-9a-f]{64}$/.test(parts.at(-1)!)||(parts.length===4&&!validIdentity(parts[2])))return false;
 const expires=Number(parts[0]);if(expires<=now||expires>now+sessionSeconds*1000)return false;
 try{return await crypto.subtle.verify('HMAC',await key(secret),Uint8Array.from(parts.at(-1)!.match(/../g)!,h=>parseInt(h,16)),encoder.encode(parts.slice(0,-1).join('.')))}catch{return false}
}

export async function codeDigest(code:string,secret:string){return hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode('staff-code:'+code)))}
