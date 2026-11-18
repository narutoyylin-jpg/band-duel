import {env} from 'cloudflare:workers';
import html from '../lesson.html?raw';
export function GET(request:Request){
  if(env.AUTH_MODE==='google')return Response.redirect(new URL('/play',request.url),302);
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
}
