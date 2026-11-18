import {env} from 'cloudflare:workers';
import {D1TeamStore,handleTeamRequest} from '../../../../team-service.mjs';
import {withPlayerIdentity} from '../../../player-identity';
const run=async(request:Request)=>handleTeamRequest(await withPlayerIdentity(request),new D1TeamStore(env.DB));
export const GET=run;
export const POST=run;
