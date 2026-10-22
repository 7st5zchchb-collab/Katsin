import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const dir=mkdtempSync(join(tmpdir(),'katsin-http-'));
try{
 const file=join(dir,'http.mjs');
 writeFileSync(file,ts.transpileModule(readFileSync('lib/http-security.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 const {boundedApiRequest,secureResponse}=await import(pathToFileURL(file).href);
 const request=(path,body,extra={})=>new Request('https://test.local'+path,{method:'POST',headers:{origin:'https://test.local','content-type':'application/json',...extra},body});
 const ok=await boundedApiRequest(request('/api/reservations',JSON.stringify({name:'Անի'})));
 assert.ok(ok instanceof Request);assert.equal((await ok.json()).name,'Անի');
 assert.equal((await boundedApiRequest(request('/api/reservations','{}',{origin:'https://attacker.test'}))).status,403);
 assert.equal((await boundedApiRequest(request('/api/reservations','{}',{'content-type':'text/plain'}))).status,415);
 assert.equal((await boundedApiRequest(request('/api/staff/session','x'.repeat(1025)))).status,413);
 // A false Content-Length cannot bypass the streamed-byte cap; Armenian UTF-8 counts as bytes.
 assert.equal((await boundedApiRequest(request('/api/staff/session','ա'.repeat(600),{'content-length':'1'}))).status,413);
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(512));c.enqueue(new Uint8Array(8192));},cancel(){cancelled=true}});
 const oversized=await boundedApiRequest(new Request('https://test.local/api/reservations',{method:'POST',duplex:'half',headers:{origin:'https://test.local','content-type':'application/json'},body:stream}));
 assert.equal(oversized.status,413);assert.equal(cancelled,true);
 const deleteRequest=new Request('https://test.local/api/staff/session',{method:'DELETE',headers:{origin:'https://test.local'}});
 assert.equal(await boundedApiRequest(deleteRequest),deleteRequest);
 const scheduleBody=JSON.stringify({entries:'x'.repeat(50000)});
 assert.ok(await boundedApiRequest(request('/api/staff/schedule',scheduleBody)) instanceof Request);
 const navigation=new Request('https://test.local/');assert.equal(await boundedApiRequest(navigation),navigation);
 for(const path of ['/admin','/admin/profile','/api/staff/profile','/api/reservations']){
  const response=secureResponse(new Response('private',{headers:{'Set-Cookie':'test=1','Cache-Control':'public, max-age=3600'}}),new Request('https://test.local'+path));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('set-cookie'),'test=1');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.ok(response.headers.get('content-security-policy').includes('https://chatgpt.com'));
  assert.equal(await response.text(),'private');
 }
 const thumb=secureResponse(new Response('image'),new Request('https://test.local/photo-previews/'+'a'.repeat(24)+'.webp'));
 assert.equal(thumb.headers.get('cache-control'),'public, max-age=31536000, immutable');
 const error=secureResponse(new Response('missing',{status:404}),new Request('https://test.local/photo-previews/'+'a'.repeat(24)+'.webp'));
 assert.equal(error.headers.has('cache-control'),false);
 console.log('PASS: CSRF origin, MIME validation, streamed UTF-8 byte limits, early cancellation, normal JSON/schedule/logout, private cache headers and preview caching.');
}finally{rmSync(dir,{recursive:true,force:true})}
