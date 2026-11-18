import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require('C:/Users/algra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const root=new URL('../',import.meta.url),mark=await fs.readFile(new URL('public/band-duel-mark.svg',root),'utf8');
const content=mark.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><g transform="translate(56 130) scale(2)">'+content+'</g></svg>';
await fs.writeFile(new URL('public/app-icon.svg',root),svg);
for(const [name,size] of [['app-icon-192.png',192],['app-icon-512.png',512],['apple-touch-icon.png',180]])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(fileURLToPath(new URL('public/'+name,root)));
console.log('Exported Band Duel desktop/home-screen icons at 180, 192 and 512 px.');
