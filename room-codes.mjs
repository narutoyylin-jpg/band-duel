export const ROOM_CODE_PATTERN=/^[A-Z0-9]{6}$/;
export const normalizeRoomCode=value=>typeof value==='string'?value.trim().toUpperCase():'';
export function randomRoomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');}
