import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {D1SocialStore,handleSocialRequest} from './social.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1EconomyStore,handleShopRequest} from './economy.mjs';
import {D1RankingStore,handleRankingRequest} from './ranking.mjs';
const {chromium}=await import('file:///C:/Users/algra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let v=[];return {bind(...values){v=values;return this;},first(){return sqlite.prepare(sql).get(...v)||null;},all(){return {results:sqlite.prepare(sql).all(...v)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...v).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let testClockOffset=0;const teams=new D1TeamStore(db);const social=new D1SocialStore(db),rooms=new D1RoomStore(db),economy=new D1EconomyStore(db),ranking=new D1RankingStore(db),errors=[];
for(const [id,name] of [['qa-alice','Alice'],['qa-bob','Bob'],['qa-cara','Cara'],['qa-dan','Dan']])await ranking.rename(id,name,Date.now());
const server=http.createServer(async(req,res)=>{
 try{
  const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base),headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.delete('oai-authenticated-user-id');if(req.headers['x-test-player'])headers.set('oai-authenticated-user-id',String(req.headers['x-test-player']));
  const body=[];for await(const chunk of req)body.push(chunk);const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});let response;
  if(url.pathname.startsWith('/api/team-rooms'))response=await handleTeamRequest(request,teams,Date.now()+testClockOffset);
  else if(url.pathname.startsWith('/api/friends'))response=await handleSocialRequest(request,social);
  else if(url.pathname.startsWith('/api/rooms'))response=await handleRoomRequest(request,rooms,Date.now()+testClockOffset);
  else if(url.pathname.startsWith('/api/shop'))response=await handleShopRequest(request,economy);
  else if(url.pathname==='/api/leaderboard')response=await handleRankingRequest(request,ranking);
  else if(url.pathname==='/api/auth/config')response=Response.json({provider:'google',configured:true,signedIn:true});
  else if(url.pathname==='/play'||url.pathname==='/')response=new Response(fs.readFileSync('phone.html'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  else{
   const root=path.resolve('public'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const mime={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.js':'text/javascript','.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8'}[path.extname(file)]||'application/octet-stream';response=new Response(fs.readFileSync(file),{headers:{'Content-Type':mime}});}else response=new Response('Not found',{status:404});
  }
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){errors.push(String(e.stack||e));res.writeHead(500);res.end('Test server error');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{

 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();page.setDefaultTimeout(14000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/play');await page.locator('#practice').click();await page.locator('[data-practice-format="2v2"]').click();await page.locator('#practiceStart').click();await page.locator('#teamCode').filter({hasText:'你＋電腦'}).waitFor();await page.locator('#teamReady').click();await page.locator('#teamStart:enabled').click();await page.locator('#teamMoveRange:enabled').waitFor();
 const record=sqlite.prepare("SELECT code FROM duel_rooms WHERE json_extract(state,'$.computer')=1").get(),code=record.code;
 async function setRange(selector,value){const range=page.locator(selector);await range.focus();await range.press('Home');const min=Number(await range.getAttribute('min'));for(let n=min;n<value;n++)await range.press('ArrowRight');}
 await setRange('#teamMoveRange',2);await page.waitForTimeout(350);assert.deepEqual((await teams.get(code)).drafts.ae,{ec:2,ev:0});
 assert.equal(await page.locator('#teamOtherRange').count(),0,'one shared slider');
 await page.locator('#teamGraph [data-team-band="ev"]').click();await page.locator('#teamMoveLabel').filter({hasText:'價帶'}).waitFor();
 await page.locator('#teamMoveCost').filter({hasText:'本次 0 點'}).waitFor();await setRange('#teamMoveRange',-1);await page.locator('#teamMoveCost').filter({hasText:'本次 2 點'}).waitFor();await page.waitForTimeout(350);
 assert.deepEqual((await teams.get(code)).drafts.ae,{ec:0,ev:-1},'switching discards the previous band action');
 await page.reload();await page.locator('#teamMoveRange:enabled').waitFor();await page.locator('#teamMoveLabel').filter({hasText:'價帶'}).waitFor();assert.equal(await page.locator('#teamMoveRange').inputValue(),'-1','restore selected band from the synced plan');
 await page.locator('#teamGraph [data-team-band="ec"]').focus();await page.locator('#teamGraph [data-team-band="ec"]').press(' ');await page.locator('#teamMoveLabel').filter({hasText:'導帶'}).waitFor();
 await setRange('#teamMoveRange',2);await page.waitForTimeout(350);assert.deepEqual((await teams.get(code)).drafts.ae,{ec:2,ev:0});
 const graphBounds=await page.locator('#teamGraph').boundingBox();assert(graphBounds.height>=300,'mobile diagram is enlarged');await page.screenshot({path:'output/band-duel-team-shuffle-mobile.png',fullPage:true});
 // A keyboard adjustment must interpolate through several SVG positions.
 const before=await page.locator('#teamGraph [data-band=ec]').getAttribute('d');await page.locator('#teamMoveRange').press('ArrowLeft');const samples=[];
 for(let i=0;i<6;i++){samples.push(await page.locator('#teamGraph [data-band=ec]').getAttribute('d'));await page.waitForTimeout(35);}assert(new Set(samples).size>=3,'live movement has intermediate animation frames');assert.notEqual(samples.at(-1),before);
 await page.locator('#teamLock').click();const captions=[];for(let i=0;i<26;i++){const text=await page.locator('#teamReplayCaption').innerText();if(/^\d\/4/.test(text))captions.push(text.slice(0,1));await page.waitForTimeout(170);}
 await page.locator('#teamNext:enabled').waitFor();assert.deepEqual([...new Set(captions)],['1','2','3','4'],'all four players animate in order');
 await page.locator('[data-team-replay="1"]').click();await page.waitForTimeout(650);await page.locator('#teamReplayCaption').filter({hasText:'1/4'}).waitFor();await page.screenshot({path:'output/band-duel-team-shuffle-replay.png',fullPage:true});
 await page.locator('[data-team-replay="5"]').click();await page.waitForTimeout(650);
 for(let round=2;round<=5;round++){await page.locator('#teamNext').click();await page.locator('#teamLock:enabled').waitFor();await page.locator('#teamLock').click();if(round<5)await page.locator('#teamNext:enabled').waitFor();else await page.locator('#teamFinal').waitFor({state:'visible'});}
 assert.equal((await teams.get(code)).game.history.length,5);assert(/對方：/.test(await page.locator('#teamFinal').innerText()));await page.screenshot({path:'output/band-duel-team-shuffle-final.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Passed: large mobile graph, tap-to-select bands, one shared slider, one action per player, discarded previous moves, restored selection and independent points, smooth live SVG motion, four separate sequential animations, individual animated replays, complete CPU match and opponent mission reveal.');
}finally{await browser.close();await new Promise(r=>server.close(r));sqlite.close();}
