const allowedOrigin = 'https://joel-plourde.github.io';
const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers});
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (origin && origin !== allowedOrigin) return respond({error:'forbidden_origin'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return respond({error:'method'},405);
  try {
    // Read a bounded body rather than trusting Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return respond({error:'invalid_input'},400);
    const chunks: Uint8Array[] = [];let length=0;
    while (true) { const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>24000){await reader.cancel();return respond({error:'invalid_input'},413);}chunks.push(value); }
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body.token !== 'string' || !/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{22})$/.test(body.token)) return respond({error:'invalid_invitation'},403);
    if (!['list','get','create','update','delete'].includes(body.action)) return respond({error:'invalid_input'},400);
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
    if (!key || !url) return respond({error:'server_error'},500);
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('awards-bingo:'+ip));
    const clientHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const response=await fetch(url+'/rest/v1/rpc/awards_bingo',{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:body.token,p_action:body.action,p_payload:body.payload??{},p_client_hash:clientHash}),
    });
    if (!response.ok) return respond({error:'server_error'},500);
    const data=await response.json();
    if(data.error)return respond({error:data.error},data.status??400);
    return respond(data);
  } catch {return respond({error:'invalid_input'},400);}
});
