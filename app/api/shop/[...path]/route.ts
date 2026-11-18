import {env} from 'cloudflare:workers';
import {D1EconomyStore,handleShopRequest} from '../../../../economy.mjs';
import {withPlayerIdentity} from '../../../player-identity';
const run=async(request:Request)=>handleShopRequest(await withPlayerIdentity(request),new D1EconomyStore(env.DB));
export const POST=run;
