import {env} from 'cloudflare:workers';
import {handleGoogleLogin} from '../../../../google-auth.mjs';

export async function POST(request:Request){
  return handleGoogleLogin(request,env);
}
