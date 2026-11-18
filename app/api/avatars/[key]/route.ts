import {env} from 'cloudflare:workers';
export async function GET(_request:Request,context:{params:Promise<{key:string}>}){
  const {key}=await context.params;
  if(!/^[a-f0-9-]{36}$/.test(key))return new Response(null,{status:404});
  const db=env.DB;if(!db)return new Response(null,{status:503});
  const row=await db.prepare('SELECT avatar_image FROM duel_profile_extras WHERE avatar_key = ?').bind(key).first<{avatar_image:string}>();
  if(!row?.avatar_image)return new Response(null,{status:404});
  return new Response(Uint8Array.from(atob(row.avatar_image),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
