import { env } from 'cloudflare:workers';
import { handleRoomRequest, D1RoomStore } from '../../../rooms-service.mjs';
import {withPlayerIdentity} from '../../player-identity';
export async function POST(request:Request){return handleRoomRequest(await withPlayerIdentity(request),new D1RoomStore(env.DB));}
