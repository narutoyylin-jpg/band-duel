import { env } from 'cloudflare:workers';
import { handleRoomRequest, D1RoomStore } from '../../../../rooms-service.mjs';
import {withPlayerIdentity} from '../../../player-identity';
const run=async(request:Request)=>handleRoomRequest(await withPlayerIdentity(request),new D1RoomStore(env.DB));
export const GET=run;
export const POST=run;
