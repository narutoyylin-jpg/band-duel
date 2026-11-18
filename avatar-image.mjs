export const MAX_AVATAR_BYTES=48*1024;
export function decodeAvatarImage(value){
  if(typeof value!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value))throw Error('請使用有效的照片頭像。');
  const raw=atob(value.slice(23));if(raw.length>MAX_AVATAR_BYTES||raw.length<100)throw Error('照片頭像太大，請重新裁切。');
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('照片格式無效。');
  let width=0,height=0;
  for(let i=2;i<bytes.length;){
    if(bytes[i++]!==255)throw Error('照片格式無效。');
    while(bytes[i]===255)i++;const marker=bytes[i++];
    if(marker===217||marker===218)break;
    if(marker===1||marker>=208&&marker<=215)continue;
    const len=bytes[i]*256+bytes[i+1];if(len<2||i+len>bytes.length)throw Error('照片格式無效。');
    if([192,193,194].includes(marker)){height=bytes[i+3]*256+bytes[i+4];width=bytes[i+5]*256+bytes[i+6];break;}
    i+=len;
  }
  if(width!==192||height!==192)throw Error('請先將照片裁切成頭像。');
  return value.slice(23);
}
