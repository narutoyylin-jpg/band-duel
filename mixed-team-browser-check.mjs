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
import {loadPlaywright} from './scripts/optional-tools.mjs';
const {chromium}=await loadPlaywright();
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
 const pages=[];
 for(const [id,width,height] of [['mixed-alice',390,844],['mixed-bob',320,568]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',extraHTTPHeaders:{'x-test-player':id}});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/play');
  await page.locator('#homeJoinOpen').waitFor({state:'visible'});assert.equal(await page.locator('#teamOpen').count(),0);
  const button=await page.locator('#homeJoinOpen').boundingBox();assert(button.y+button.height<=height,'home join is visible without scrolling');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));pages.push(page);
 }
 const [alice,bob]=pages;
 await alice.screenshot({path:'output/band-duel-direct-join-home.png',fullPage:true});
 await alice.locator('#create').click();await alice.locator('[data-room-format="2v2"]').click();
 await alice.locator('#roomCreateInput').fill('BOT123');await alice.locator('#roomSetupTimer').click();
 assert.equal(await alice.locator('#roomSetupTimer').getAttribute('aria-checked'),'false');
 await alice.screenshot({path:'output/band-duel-room-optional-clock.png',fullPage:true});
 await alice.locator('#roomCreateSubmit').click();await alice.locator('#teamRoster').waitFor({state:'visible'});
 await bob.locator('#homeJoinOpen').click();await bob.locator('#codeInput').fill('BOT123');
 await bob.locator('#teamRoster').waitFor({state:'visible'});
 await alice.waitForFunction(()=>ui.data?.humanCount===2);assert.equal(await alice.evaluate(()=>ui.data.timed),false);
 await Promise.all(pages.map(page=>page.locator('#teamReady').click()));await alice.locator('#teamStart:enabled').click();
 await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));
 assert.equal(await alice.evaluate(()=>ui.data.hasComputers),true);assert.equal(await alice.evaluate(()=>ui.data.players.filter(p=>p.computer).length),2);
 assert.equal(await alice.locator('#clockPanel').isVisible(),false);
 await alice.screenshot({path:'output/band-duel-two-human-cpu-battle.png',fullPage:true});
 for(let round=1;round<=5;round++){
  await Promise.all(pages.map(async page=>{await page.locator('#teamHold').click();await page.locator('#teamLock').click();}));
  if(round===5){await Promise.all(pages.map(page=>page.locator('#verdict[open]').waitFor()));break;}
  await Promise.all(pages.map(page=>page.locator('#teamNext:enabled').waitFor()));await Promise.all(pages.map(page=>page.locator('#teamNext').click()));
  await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));
 }
 for(const page of pages){assert.equal(await page.evaluate(()=>ui.data.history.length),5);await page.locator('#verdictConfirm:enabled').click();await page.locator('#verdict').waitFor({state:'hidden'});await page.locator('#teamBack').click();}
 assert.equal((await ranking.profile('mixed-alice')).games,0);
 // A ranked queue can wait inside the existing 2v2 practice experience.
 for(const page of pages){await page.locator('[data-match-format="2v2"]').click();await page.locator('#rankedMatch').click();await page.locator('#teamMatchSolo').click();}
 await alice.waitForFunction(()=>ui.data?.cpuFillAt>0);await alice.locator('#waitingLesson').waitFor({state:'visible'});
 await alice.locator('#waitingPractice').click();await alice.waitForFunction(()=>ui.data?.computer===true&&!!ui.queue);assert(await alice.locator('#queuePracticeBanner').isVisible());
 clockOffset+=16000;
 await Promise.all(pages.map(page=>page.evaluate(()=>refresh())));
 await Promise.all(pages.map(page=>page.waitForFunction(()=>ui.kind==='team'&&ui.data?.stage==='lobby'&&ui.data?.ranked===true&&!ui.data?.computer)));
 assert.equal(await alice.locator('#queuePracticeBanner').isVisible(),false);
 assert.equal(await alice.evaluate(()=>ui.data.humanCount),2);assert.equal(await alice.evaluate(()=>ui.data.hasComputers),true);
 await alice.screenshot({path:'output/band-duel-ranked-cpu-fill-lobby.png',fullPage:true});
 await Promise.all(pages.map(page=>page.locator('#teamReady').click()));await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));
 assert(await alice.locator('#clockPanel').isVisible());
 for(let round=1;round<=5;round++){
  clockOffset+=31000;await Promise.all(pages.map(page=>page.evaluate(()=>refresh())));
  if(round===5){await Promise.all(pages.map(page=>page.locator('#verdict[open]').waitFor()));break;}
  await Promise.all(pages.map(page=>page.locator('#teamNext:enabled').waitFor()));await Promise.all(pages.map(page=>page.locator('#teamNext').click()));await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));
 }
 for(const page of pages){assert.equal(await page.evaluate(()=>ui.data.history.length),5);assert(await page.evaluate(()=>!!ui.data.ratingResult));await page.locator('#verdictConfirm:enabled').click();await page.locator('#verdict').waitFor({state:'hidden'});}
 for(const id of ['mixed-alice','mixed-bob'])assert.equal((await ranking.profile(id)).games,1);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_players').get().n,2);
 await alice.screenshot({path:'output/band-duel-mixed-ranked-result.png',fullPage:true});
 await alice.locator('#teamBack').click();await alice.locator('#tutorialOpen').click();
 assert.equal(await alice.locator('[data-tutorial]').count(),10);
 for(const topic of ['team','skills','matching']){await alice.locator('[data-tutorial="'+topic+'"]').click();await alice.waitForFunction(()=>tutorialMotion.step>=1);assert(await alice.locator('#demoCaption').innerText());}
 assert.deepEqual(errors,[]);console.log('Passed: 320/390px direct joining, unified 2v2 room detection, timer-off room, full two-human CPU game, 15s ranked CPU fill during practice, automatic handoff, full mixed ranked settlement, no CPU accounts, and all ten tutorial topics.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));sqlite.close();}
