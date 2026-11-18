import {fileURLToPath} from 'node:url';

const [command,...args]=process.argv.slice(2);
if(!['dev','build'].includes(command))throw Error('Expected dev or build.');
process.env.BAND_DUEL_STANDALONE='1';
const cli=new URL('../node_modules/vite/bin/vite.js',import.meta.url);
process.argv=[process.execPath,fileURLToPath(cli),command,'--configLoader','native',...(command==='dev'?['--port','5173']:[]),...args];
await import(cli.href);
