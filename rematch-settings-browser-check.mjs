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
  const page=await context.newPage();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/play');pages.push(page);
 }
 const [alice,bob]=pages,code='LOOP11';let serial=0;
 const ids=['mixed-alice','mixed-bob'];
 async function request(team,credentials,index,op,body={}){
  const response=await fetch(origin+'/api/'+(team?'team-rooms':'rooms')+'/'+code+'/'+op,{method:'POST',headers:{'Content-Type':'application/json','x-test-player':ids[index],Authorization:'Bearer '+credentials.token},body:JSON.stringify({requestId:'browser-loop-'+(++serial),...body})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
 }
 async function setupDuel(){
  await Promise.all(pages.map(page=>page.locator('#versusContinue').click()));
  for(const page of pages)if(await page.evaluate(()=>ui.data.skills?.enabled)){await page.locator('#skillDraft[open]').waitFor();assert.equal(await page.locator('[data-draft-skill]').count(),3);await page.locator('#skillDraftConfirm:enabled').click();}
  await alice.locator('#roleEc').click();await bob.locator('#roleEv').click();
  await alice.locator('[data-mode="shuffle"]').click();await Promise.all(pages.map(page=>page.locator('#coinContinue:enabled').click()));
  await Promise.all(pages.map(page=>page.locator('#playGraph').waitFor({state:'visible'})));
 }
 async function finish(team,credentials){
  for(let round=1;round<=5;round++){
   const record=await (team?teams:rooms).get(code),matchId=record.matchId;
   if(team){
    clockOffset+=31000;await teams.get(code);await Promise.all(pages.map(page=>page.evaluate(()=>refresh())));
   }else{
    const first=record.firstStarter==='player'?0:1,action=round===1?{kind:'own',direction:1,amount:1}:{kind:'hold',direction:1,amount:0};
    for(const index of [first,1-first])await request(false,credentials[index],index,'lock',{round,matchId,action});
   }
   if(round<5){for(let index=0;index<2;index++)await request(team,credentials[index],index,team?'next':'ready',{round,matchId});}
  }
  await Promise.all(pages.map(page=>page.evaluate(()=>refresh())));
  await Promise.all(pages.map(page=>page.locator('#verdict[open]').waitFor()));
  await Promise.all(pages.map(page=>page.locator('#verdictConfirm:enabled').click()));
  await Promise.all(pages.map(page=>page.locator('#verdict').waitFor({state:'hidden'})));
 }
 for(const team of [false,true]){
  await alice.locator('#create').click();await alice.locator('[data-room-format="'+(team?'2v2':'1v1')+'"]').click();await alice.locator('#roomCreateInput').fill(code);
  if((await alice.locator('#roomSetupTimer').getAttribute('aria-checked'))==='true')await alice.locator('#roomSetupTimer').click();
  // Team CPU completion uses its own clock, while custom human planning has no deadline.
  if(team)await alice.locator('#roomSetupTimer').click();
  await alice.locator('#roomCreateSubmit').click();await bob.locator('#homeJoinOpen').click();await bob.locator('#codeInput').fill(code);
  if(team){
   await Promise.all(pages.map(page=>page.locator('#teamRoster').waitFor({state:'visible'})));await alice.waitForFunction(()=>ui.data.humanCount===2);
   await Promise.all(pages.map(page=>page.locator('#teamReady').click()));await alice.locator('#teamStart:enabled').click();await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));
  }else await setupDuel();
  const credentials=await Promise.all(pages.map(page=>page.evaluate(()=>({...ui.credentials}))));
  const before=await alice.evaluate(()=>({code:ui.data.code,matchId:ui.data.matchId,version:ui.data.version,timed:ui.data.timed}));
  await finish(team,credentials);
  if(team)assert.equal(await alice.locator('.battle-hud').evaluate(element=>getComputedStyle(element).position),'static','finished mission HUD must not cover next-match settings');
  const button=team?'#teamRematch':'#roomRematch',status=team?'#teamRematchStatus':'#roomRematchStatus';
  await Promise.all(pages.map(page=>page.locator(button+':enabled').waitFor()));
  const prefix=team?'team':'room',panel='#'+prefix+'RematchSettings';
  await Promise.all(pages.map(page=>page.locator(panel).waitFor({state:'visible'})));
  assert.equal(await bob.locator(panel+' button:enabled').count(),0,'guest sees settings but cannot edit');
  const oldResult=await alice.evaluate(()=>({rounds:ui.data.roundLimit,timed:ui.data.timed,history:JSON.stringify(ui.data.history)}));
  await bob.locator(button).click();await alice.waitForFunction(()=>ui.data.rematchReadyCount===1);
  await alice.locator(panel+' [data-rematch-setting="rounds"][data-rematch-value="12"]').click();
  await Promise.all(pages.map(page=>page.waitForFunction(()=>ui.data.rematchSettings.rounds===12&&ui.data.rematchReadyCount===0)));
  await alice.locator(panel+' [data-rematch-setting="abilityMode"][data-rematch-value="skills"]').click();
  await alice.waitForFunction(()=>ui.data.rematchSettings.abilityMode==='skills');
  await alice.locator('#'+prefix+'RematchTimedSwitch').click();
  await Promise.all(pages.map(page=>page.waitForFunction(old=>ui.data.rematchSettings.timed!==old,before.timed)));
  assert.deepEqual(await alice.evaluate(()=>({rounds:ui.data.roundLimit,timed:ui.data.timed,history:JSON.stringify(ui.data.history)})),oldResult,'editing next settings preserves completed results');
  assert.match(await bob.locator('#'+prefix+'RematchSettingsSummary').innerText(),/12/);
  await alice.locator(panel).scrollIntoViewIfNeeded();await alice.screenshot({path:'output/band-duel-'+prefix+'-rematch-settings-host.png',fullPage:true});
  await bob.locator(panel).scrollIntoViewIfNeeded();await bob.screenshot({path:'output/band-duel-'+prefix+'-rematch-settings-guest.png',fullPage:true});
  await bob.locator(button).click();await alice.waitForFunction(()=>ui.data.rematchReadyCount===1);
  await alice.locator(button).click();await Promise.all(pages.map(page=>page.waitForFunction(old=>ui.data.matchId!==old,before.matchId)));
  for(const page of pages){const fresh=await page.evaluate(()=>({code:ui.data.code,version:ui.data.version,round:ui.data.round,roundLimit:ui.data.roundLimit,history:ui.data.history.length,budget:ui.data.yourBudget,timed:ui.data.timed,skills:ui.data.skills.enabled}));assert.equal(fresh.code,before.code);assert.equal(fresh.round,1);assert.equal(fresh.roundLimit,12);assert.equal(fresh.history,0);assert.equal(fresh.budget,30);assert.equal(fresh.timed,!before.timed);assert(fresh.skills);assert(fresh.version>before.version);assert.equal(await page.locator('#verdict').isVisible(),false);}
  if(team){await Promise.all(pages.map(page=>page.locator('#teamRoster').waitFor({state:'visible'})));assert.equal(await alice.evaluate(()=>ui.data.players.filter(p=>p.computer).length),2);for(const page of pages){await page.locator('#skillDraft[open]').waitFor();assert.equal(await page.locator('[data-draft-skill]').count(),3);await page.locator('#skillDraftConfirm:enabled').click();}await Promise.all(pages.map(page=>page.locator('#teamReady').click()));await alice.locator('#teamStart:enabled').click();await Promise.all(pages.map(page=>page.locator('#teamLock:enabled').waitFor()));}
  else await setupDuel();
  for(const page of pages){assert.equal(await page.evaluate(()=>ui.data.roundLimit),12);assert.equal(await page.locator('#clockPanel').isVisible(),!before.timed);}
  if(team)await alice.locator('#teamClose').click();else{await alice.evaluate(()=>command('close'));await alice.locator('#closedBack').click();}await alice.locator('#create').waitFor({state:'visible'});assert.equal((await (team?teams:rooms).get(code)).stage,'closed');
  await bob.evaluate(()=>refresh());if(await bob.locator('#closedBack').isVisible())await bob.locator('#closedBack').click();if(team&&await bob.locator('#teamBack').isVisible())await bob.locator('#teamBack').click();await bob.locator('#homeJoinOpen').waitFor({state:'visible'});
 }
 assert.deepEqual(errors,[]);console.log('Passed: mobile 1v1/2v2 host changes rounds, abilities and clock; peers see read-only settings; edits reset consent and preserve old results; new same-room match has 12 rounds, 30 points, fresh ability choices and the selected clock, and is playable.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));sqlite.close();}
