import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1RankingStore,handleRankingRequest} from './ranking.mjs';
import {D1EconomyStore,handleShopRequest} from './economy.mjs';
import {D1SocialStore,handleSocialRequest} from './social.mjs';
const {chromium}=await import('file:///C:/Users/algra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const teams=new D1TeamStore(db),rooms=new D1RoomStore(db),ranking=new D1RankingStore(db),economy=new D1EconomyStore(db),social=new D1SocialStore(db),errors=[];
let clockOffset=0;
for(const [id,name] of [['mixed-alice','Alice'],['mixed-bob','Bob']])await ranking.rename(id,name,Date.now());
const server=http.createServer(async(req,res)=>{
 try{
  const origin='http://127.0.0.1:'+server.address().port,url=new URL(req.url,origin),headers=new Headers();
  for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  headers.delete('oai-authenticated-user-id');if(req.headers['x-test-player'])headers.set('oai-authenticated-user-id',req.headers['x-test-player']);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});let response;
  if(url.pathname.startsWith('/api/team-rooms'))response=await handleTeamRequest(request,teams,Date.now()+clockOffset);
  else if(url.pathname.startsWith('/api/rooms'))response=await handleRoomRequest(request,rooms,Date.now()+clockOffset);
  else if(url.pathname.startsWith('/api/leaderboard'))response=await handleRankingRequest(request,ranking);
  else if(url.pathname.startsWith('/api/shop'))response=await handleShopRequest(request,economy);
  else if(url.pathname.startsWith('/api/friends'))response=await handleSocialRequest(request,social);
  else if(url.pathname==='/api/auth/config')response=Response.json({provider:'google',configured:true,signedIn:true});
  else if(url.pathname==='/'||url.pathname==='/play')response=new Response(fs.readFileSync('phone.html'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  else {const root=path.resolve('public'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));response=file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?new Response(fs.readFileSync(file),{headers:{'Content-Type':({'.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.js':'text/javascript','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream'}}):new Response(null,{status:404});}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){errors.push(String(e.stack||e));res.writeHead(500);res.end('Local test error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 await ranking.rename('depart-cara','Cara',Date.now());const pages=[];
 for(const [id,width,height] of [['mixed-alice',390,844],['mixed-bob',320,568],['depart-cara',390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',extraHTTPHeaders:{'x-test-player':id}});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/play');pages.push(page);
 }
 const [alice,bob,cara]=pages;
 async function create(page,code,format){await page.locator('#create').click();await page.locator('[data-room-format="'+format+'"]').click();await page.locator('#roomCreateInput').fill(code);await page.locator('#roomCreateSubmit').click();}
 async function join(page,code){await page.locator('#homeJoinOpen').click();await page.locator('#codeInput').fill(code);}
 async function leave(page){await page.locator('.topbar>.home-link').click();await page.locator('#homeJoinOpen').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>ui.credentials),null);}
 async function startDuel(host,peer){await Promise.all([host,peer].map(page=>page.locator('#versusContinue').click()));await host.locator('#roleEc').click();await peer.locator('#roleEv').click();await host.locator('[data-mode="shuffle"]').click();await Promise.all([host,peer].map(page=>page.locator('#coinContinue:enabled').click()));await Promise.all([host,peer].map(page=>page.locator('#playGraph').waitFor({state:'visible'})));}
 // A departed 1v1 host leaves the other player's exact seat as the new host.
 await create(alice,'KEEP11','1v1');await join(bob,'KEEP11');await startDuel(alice,bob);
 const first=await bob.evaluate(()=>({code:ui.data.code,matchId:ui.data.matchId,token:ui.credentials.token}));await leave(alice);
 await bob.waitForFunction(()=>ui.data?.stage==='lobby'&&ui.data.host===true&&!ui.data.joined);
 assert.equal(await bob.evaluate(()=>ui.data.code),first.code);assert.equal(await bob.evaluate(()=>ui.credentials.token),first.token);assert(await bob.locator('#roomClose').isVisible());assert.match(await bob.locator('#roomDepartureNotice').innerText(),/房主/);
 await bob.screenshot({path:'output/band-duel-duel-host-transfer.png',fullPage:true});await join(cara,'KEEP11');await startDuel(bob,cara);
 assert.equal(await bob.evaluate(()=>ui.data.canChooseMode),true);assert.equal(await cara.evaluate(()=>ui.data.host),false);
 await leave(bob);await cara.waitForFunction(()=>ui.data?.stage==='lobby'&&ui.data.host===true);await cara.locator('#roomClose').click();await cara.locator('#homeJoinOpen').waitFor({state:'visible'});assert.equal((await rooms.get('KEEP11')).stage,'closed');
 // In a team lobby, CPUs fill vacancies and can be replaced before the start.
 await create(alice,'KEEP22','2v2');await join(bob,'KEEP22');await bob.locator('#teamRoster').waitFor({state:'visible'});await alice.waitForFunction(()=>ui.data.humanCount===2);await leave(alice);
 await bob.waitForFunction(()=>ui.data?.host===true&&ui.data.humanCount===1&&ui.data.hasComputers===true);
 assert.equal(await bob.evaluate(()=>ui.data.players.filter(p=>p.computer).length),3);assert(await bob.locator('#teamClose').isVisible());assert.match(await bob.locator('#teamDepartureNotice').innerText(),/電腦/);
 await bob.screenshot({path:'output/band-duel-team-host-transfer.png',fullPage:true});await join(cara,'KEEP22');await cara.locator('#teamRoster').waitFor({state:'visible'});await bob.waitForFunction(()=>ui.data.humanCount===2);assert.equal(await cara.locator('#teamClose').isVisible(),false);
 await Promise.all([bob,cara].map(page=>page.locator('#teamReady').click()));await bob.locator('#teamStart:enabled').click();await Promise.all([bob,cara].map(page=>page.locator('#teamLock:enabled').waitFor()));
 const before=await teams.get('KEEP22'),caraSlot=await cara.evaluate(()=>ui.data.yourSlot);await cara.locator('#teamPlus').click();await cara.locator('#teamLock').click();await leave(cara);
 await bob.waitForFunction(()=>ui.data.humanCount===1&&ui.data.players.filter(p=>p.computer).length===3);
 const takeover=await teams.get('KEEP22');assert.equal(takeover.game.budgets[caraSlot],before.game.budgets[caraSlot]);assert.equal(takeover.locked[caraSlot],true);assert.equal(takeover.players[caraSlot],null);assert.equal(takeover.seats[caraSlot],'computer:'+takeover.matchId+':'+caraSlot);
 await bob.locator('#teamHold').click();await bob.locator('#teamLock').click();clockOffset+=3000;await bob.evaluate(()=>refresh());await bob.locator('#teamNext:enabled').waitFor();await bob.locator('#teamNext').click();await bob.locator('#teamLock:enabled').waitFor();assert.equal(await bob.evaluate(()=>ui.data.round),2);
 await bob.screenshot({path:'output/band-duel-cpu-takeover-live.png',fullPage:true});await bob.locator('#teamClose').click();await bob.locator('#homeJoinOpen').waitFor({state:'visible'});assert.equal((await teams.get('KEEP22')).stage,'closed');
 await create(alice,'KEEP22','1v1');await alice.waitForFunction(()=>ui.data?.stage==='lobby');await leave(alice);assert.equal((await rooms.get('KEEP22')).stage,'closed','last human releases the reused code');
 assert.deepEqual(errors,[]);console.log('Passed: mobile individual exits return home while peers remain; 1v1 host transfer and replacement-role/mode selection; 2v2 CPU lobby fill, replacement joining, active locked-action takeover and next round; explicit host closure and final-human code release.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));sqlite.close();}
