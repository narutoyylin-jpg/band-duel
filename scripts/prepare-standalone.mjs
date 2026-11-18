import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID;
const clientId=process.env.GOOGLE_CLIENT_ID;
if(!/^[0-9a-f-]{36}$/i.test(databaseId||''))throw Error('Set CLOUDFLARE_D1_DATABASE_ID to your D1 database ID.');
if(!clientId?.endsWith('.apps.googleusercontent.com'))throw Error('Set GOOGLE_CLIENT_ID to your Google OAuth web client ID.');
const source=resolve('dist/server/wrangler.json');
const config=JSON.parse(readFileSync(source,'utf8'));
config.name='band-duel';
config.triggers={crons:['5 16 * * *']};
config.vars={...(config.vars||{}),AUTH_MODE:'google',GOOGLE_CLIENT_ID:clientId};
config.d1_databases=[{binding:'DB',database_name:'band-duel',database_id:databaseId}];
delete config.services;
const target=resolve('dist/server/wrangler.standalone.json');
writeFileSync(target,JSON.stringify(config,null,2)+'\n');
process.stdout.write(`Prepared independent Cloudflare deployment: ${target}\n`);
