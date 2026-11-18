export const FIRST_SEASON='2026-10';
export const SEASON_MIN_GAMES=10;
export const SEASON_GRACE_MS=5*60*1000;
export const CHAMPION_SKIN='season-champion';
export function seasonKey(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,7);}
export function seasonBounds(key){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw Error('Invalid season');
 const [year,month]=key.split('-').map(Number);
 return {start:Date.UTC(year,month-1,1)-8*3600000,end:Date.UTC(year,month,1)-8*3600000};
}
export function seasonReward(rank){
 if(!Number.isInteger(rank)||rank<1)throw Error('Invalid season rank');
 return rank===1?{coins:500,medals:150,champion:true,badge:true}:rank<=3?{coins:300,medals:100,champion:false,badge:true}:rank<=10?{coins:150,medals:60,champion:false,badge:false}:{coins:50,medals:20,champion:false,badge:false};
}
