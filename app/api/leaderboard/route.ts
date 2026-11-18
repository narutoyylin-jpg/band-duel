import {env} from 'cloudflare:workers';
import {D1RankingStore,handleRankingRequest} from '../../../ranking.mjs';
import {withPlayerIdentity} from '../../player-identity';
const run=async(request:Request)=>handleRankingRequest(await withPlayerIdentity(request),new D1RankingStore(env.DB));
export const GET=run;
export const POST=run;
