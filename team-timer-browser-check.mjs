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
import {loadPlaywright} from './scripts/optional-tools.mjs';
const {chromium}=await loadPlaywright();
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
 const pages=[],contexts=[];for(const [i,id] of ['qa-alice','qa-bob','qa-cara','qa-dan'].entries()){
  const context=await browser.newContext({viewport:i===1?{width:1280,height:850}:{width:390,height:844},isMobile:i!==1,hasTouch:i!==1,extraHTTPHeaders:{'x-test-player':id},reducedMotion:'reduce'});contexts.push(context);await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/play');pages.push(page);
 }
 const [ae,av,be,bv]=pages;await ae.locator('#create').click();await ae.locator('[data-room-format="2v2"]').click();await ae.locator('#roomCreateSubmit').click();await ae.locator('#teamCode').filter({hasText:/^[A-Z0-9]{6}$/}).waitFor();const code=await ae.locator('#teamCode').innerText();for(const page of [av,be,bv]){await page.locator('#homeJoinOpen').click();await page.locator('#codeInput').fill(code);await page.locator('#teamCode').filter({hasText:code}).waitFor();}
 await ae.locator('.team-seat').filter({hasText:'Dan'}).waitFor();await ae.screenshot({path:'output/band-duel-team-lobby-mobile.png',fullPage:true});await Promise.all(pages.map(p=>p.locator('#teamReady').click()));await ae.locator('#teamStart:enabled').waitFor();await ae.locator('#teamStart').click();await Promise.all(pages.map(p=>p.locator('#teamMoveRange:enabled').waitFor()));
 async function range(page,value){const range=page.locator('#teamMoveRange');await range.focus();await range.press('Home');const min=Number(await range.getAttribute('min'));for(let i=min;i<value;i++)await range.press('ArrowRight');}
 await Promise.all([range(ae,1),range(be,-3),range(bv,4)]);await ae.locator('#teamOpponent').filter({hasText:'−0.06'}).waitFor();await av.locator('#teamOpponent').filter({hasText:'+0.08'}).waitFor();const beforeContinuous=(await teams.get(code)).sequences.be;for(let i=0;i<16;i++){await be.locator('#teamMoveRange').press(i<8?'ArrowRight':'ArrowLeft');await be.waitForTimeout(60);}await be.waitForTimeout(160);assert((await teams.get(code)).sequences.be-beforeContinuous>=3,'continuous adjustment publishes intermediate live plans');await range(be,-3);await ae.locator('#teamOpponent').filter({hasText:'−0.06'}).waitFor();await ae.waitForTimeout(350);const privateSvg=await ae.locator('#teamGraph').innerHTML();await range(av,-2);await av.waitForTimeout(700);assert.equal(await ae.locator('#teamGraph').innerHTML(),privateSvg,'teammate edits never alter the private live preview');await ae.reload();await ae.locator('#teamMoveRange').waitFor();assert.equal(await ae.locator('#teamMoveRange').inputValue(),'1','reconnect restores the last synced draft');await ae.locator('#teamOpponent').filter({hasText:'−0.06'}).waitFor();await ae.screenshot({path:'output/band-duel-team-live-mobile.png',fullPage:true});
 await Promise.all([ae,av,be].map(p=>p.locator('#teamLock').click()));await be.locator('#teamLock').filter({hasText:'已鎖定'}).waitFor();await ae.locator('#teamOpponent').filter({hasText:'已鎖定'}).waitFor();assert.equal(await ae.locator('#teamGraph').isVisible(),true,'locked players can keep watching');testClockOffset=31000;await Promise.all(pages.map(p=>p.locator('#teamNext').waitFor({state:'visible'})));let record=await teams.get(code);assert.equal(record.game.history.length,1);assert.deepEqual(record.game.board,{aEc:1,aEv:-2,bEc:-3,bEv:4});assert.deepEqual(record.game.history[0].autoLocked,['bv']);
 for(let round=2;round<=5;round++){
  await Promise.all(pages.map(p=>p.locator('#teamNext').click()));await Promise.all(pages.map(p=>p.locator('#teamMoveRange:enabled').waitFor()));await Promise.all(pages.map(p=>p.locator('#teamLock').click()));if(round<5)await Promise.all(pages.map(p=>p.locator('#teamNext:enabled').waitFor()));else await Promise.all(pages.map(p=>p.locator('#teamFinal').waitFor({state:'visible'})));
 }
 record=await teams.get(code);assert.equal(record.game.history.length,5);assert.equal(record.stage,'finished');assert.equal(await ae.locator('#teamFinal').getAttribute('data-outcome'),await av.locator('#teamFinal').getAttribute('data-outcome'));await ae.screenshot({path:'output/band-duel-team-result-mobile.png',fullPage:true});
 // A real 30-second computer turn auto-locks the edited plan without user confirmation.
 await ae.locator('#teamBack').click();await ae.locator('#practice').click();await ae.locator('#practiceStart').click();await ae.locator('#versusContinue').waitFor({state:'visible'});await ae.locator('#versusContinue').click();await ae.locator('#roleEc').click();await ae.locator('[data-mode="types"]').click();await ae.locator('#coinContinue').waitFor({state:'visible'});await ae.locator('#coinContinue').click();await ae.locator('#lock').waitFor({state:'visible'});await ae.locator('#offset').focus();await ae.locator('#offset').press('Home');await ae.locator('#clockPanel').waitFor({state:'visible'});assert(/\d+s/.test(await ae.locator('#clockValue').innerText()));await ae.screenshot({path:'output/band-duel-countdown-mobile.png',fullPage:true});await ae.setViewportSize({width:360,height:667});await ae.locator('#lock').scrollIntoViewIfNeeded();const missionBounds=await ae.locator('#missionCard').boundingBox();assert(missionBounds.y>=0&&missionBounds.y+missionBounds.height<667,'mission remains visible on a short phone');const lockBounds=await ae.locator('#lock').boundingBox();assert(lockBounds.y+lockBounds.height<=667,'small-phone lock fits with the countdown');await ae.setViewportSize({width:390,height:844});await ae.locator('#next').waitFor({state:'visible',timeout:38000});await ae.locator('#resultType').click();await ae.locator('#ownMove').filter({hasText:'−0.08'}).waitFor();assert.deepEqual(errors,[]);console.log('Passed: four real player UIs, lobby/readiness, live same-role previews, teammate secrecy, reconnect, immutable locks, shared timeout, full match, result replay and a real 30-second 1v1 auto-lock.');
}finally{await browser.close();await new Promise(r=>server.close(r));sqlite.close();}
