import {env} from 'cloudflare:workers';
import {D1SocialStore,handleSocialRequest} from '../../../social.mjs';
import {withPlayerIdentity} from '../../player-identity';
const run=async(request:Request)=>handleSocialRequest(await withPlayerIdentity(request),new D1SocialStore(env.DB));
export const GET=run;
export const POST=run;
