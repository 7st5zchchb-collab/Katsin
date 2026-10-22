// Applied before routing: limits actual streamed bytes, including chunked requests.
export async function boundedApiRequest(request:Request):Promise<Request|Response>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/')||!['POST','PUT','PATCH','DELETE'].includes(request.method))return request;
 const fail=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Անթույլատրելի հարցում։',403);
 if(!request.body)return request;
 const limit=path==='/api/staff/session'?1024:path==='/api/reservations'?8192:262144;
 const length=request.headers.get('content-length');
 if(length&&(!/^\d+$/.test(length)||Number(length)>limit))return fail('Հարցման ծավալը չափազանց մեծ է։',413);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return fail('Ուղարկեք JSON ձևաչափով հարցում։',415);
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>limit){await reader.cancel();return fail('Հարցման ծավալը չափազանց մեծ է։',413)}chunks.push(value);
  }
 }catch{return fail('Հարցումը հնարավոր չէ կարդալ։',400)}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
 return new Request(request,{body});
}

export function secureResponse(response:Response,request:Request){
 const headers=new Headers(response.headers),path=new URL(request.url).pathname;
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 // Preserve Sites' ChatGPT embedding while rejecting arbitrary third-party frames.
 if(!headers.has('Content-Security-Policy'))headers.set('Content-Security-Policy',"base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com");
 if(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/'))headers.set('Cache-Control','private, no-store');
 if(/^\/photo-previews\/[a-f0-9]{24}\.webp$/.test(path)&&response.ok)headers.set('Cache-Control','public, max-age=31536000, immutable');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
