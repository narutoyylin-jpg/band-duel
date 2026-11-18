import {env} from 'cloudflare:workers';
import {googleAuthConfigured,sessionSubject} from '../../../../google-auth.mjs';

export async function GET(request:Request){
  const google=env.AUTH_MODE==='google';
  const signedIn=google&&googleAuthConfigured(env)?!!(await sessionSubject(request,env.BAND_DUEL_SESSION_SECRET)):false;
  return Response.json({provider:google?'google':'chatgpt',configured:google?googleAuthConfigured(env):true,clientId:google?env.GOOGLE_CLIENT_ID||null:null,signedIn},{headers:{'Cache-Control':'no-store'}});
}
