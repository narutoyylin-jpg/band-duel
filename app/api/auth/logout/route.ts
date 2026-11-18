import {env} from 'cloudflare:workers';
import {clearSessionCookie} from '../../../../google-auth.mjs';

export function POST(request:Request){
  if(env.AUTH_MODE!=='google')return Response.json({error:'此版本使用網站登入。'},{status:404});
  if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'請從 Band Duel 網站操作。'},{status:403});
  return Response.json({ok:true},{headers:{'Set-Cookie':clearSessionCookie(new URL(request.url).protocol==='https:'),'Cache-Control':'no-store'}});
}
