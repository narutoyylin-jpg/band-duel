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
const social=new D1SocialStore(db),rooms=new D1RoomStore(db),economy=new D1EconomyStore(db),ranking=new D1RankingStore(db),errors=[];
for(const [id,name] of [['qa-alice','Alice'],['qa-bob','Bob']])await ranking.rename(id,name,Date.now());
const server=http.createServer(async(req,res)=>{
 try{
  const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base),headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.delete('oai-authenticated-user-id');if(req.headers['x-test-player'])headers.set('oai-authenticated-user-id',String(req.headers['x-test-player']));
  const body=[];for await(const chunk of req)body.push(chunk);const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});let response;
  if(url.pathname.startsWith('/api/friends'))response=await handleSocialRequest(request,social);
  else if(url.pathname.startsWith('/api/rooms'))response=await handleRoomRequest(request,rooms);
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
 const aliceContext=await browser.newContext({viewport:{width:1280,height:850},extraHTTPHeaders:{'x-test-player':'qa-alice'},reducedMotion:'reduce'}),bobContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,extraHTTPHeaders:{'x-test-player':'qa-bob'},reducedMotion:'reduce'});
 for(const context of [aliceContext,bobContext])await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const alice=await aliceContext.newPage(),bob=await bobContext.newPage();for(const page of [alice,bob]){page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);await page.goto(origin+'/play');await page.locator('#coverName').filter({hasText:/Alice|Bob/}).waitFor();await page.locator('#friendsOpen').click();await page.locator('#friendCode').filter({hasText:/^[A-Z2-9]{10}$/}).waitFor();}
 const code=await bob.locator('#friendCode').innerText();await alice.locator('#friendAddCode').fill(code);await alice.locator('#friendAddSubmit').click();await alice.locator('#friendsStatus').filter({hasText:'已送出好友邀請'}).waitFor();await bob.locator('#friendsRefresh').click();await bob.locator('#friendsincoming [data-social-op="accept"]').click();await bob.locator('#friendsfriends').filter({hasText:'Alice'}).waitFor();await alice.locator('#friendsRefresh').click();await alice.locator('#friendsfriends').filter({hasText:'Bob'}).waitFor();
 await bob.screenshot({path:'output/band-duel-friends-mobile.png',fullPage:true});
 await alice.locator('#friendsfriends [data-social-op="invite"]').click();await alice.locator('#friendsStatus').filter({hasText:'已送出房間邀請'}).waitFor();await bob.locator('#friendsRefresh').click();await bob.locator('[data-join-invite]').click();await bob.locator('#versusContinue').waitFor({state:'visible'});await bob.locator('#versusContinue').click();await alice.locator('#friendsClose').click();await alice.locator('#versusContinue').waitFor({state:'visible'});await alice.locator('#versusContinue').click();
 await alice.locator('[data-character="split"]').click();await alice.locator('#roleEc').click();await bob.locator('[data-character="charge"]').click();await bob.screenshot({path:'output/band-duel-character-mobile.png',fullPage:true});
 await bob.locator('#roleEv').click();await alice.locator('[data-mode="together"]').waitFor({state:'visible'});await alice.locator('[data-mode="together"]').click();for(const p of [alice,bob]){await p.locator('#coinContinue').waitFor({state:'visible'});await p.locator('#coinContinue').click();}
 const roomRow=sqlite.prepare('SELECT state FROM duel_rooms WHERE json_extract(state,\'$.stage\')=\'plan\'').get(),room=JSON.parse(roomRow.state),first=room.firstStarter==='player'?alice:bob,second=first===alice?bob:alice;
 await first.locator('#lock').waitFor({state:'visible'});await first.locator('#lock').press('Enter');await first.locator('#lockScreen').waitFor({state:'visible'});await first.locator('#greetingOpen').click();await first.locator('[data-greeting="hello"]').click();await second.locator('#greetingBubble').filter({hasText:'你好'}).waitFor();assert.equal(await first.locator('#lockScreen').isVisible(),true);await second.locator('#lock').waitFor({state:'visible'});await second.locator('#lock').press('Enter');
 for(const p of [alice,bob]){await p.locator('#next').waitFor({state:'visible'});await p.locator('#next').click();}
 await first.locator('#lock').waitFor({state:'visible'});await first.locator('#skillUse').click();await first.locator('#skillUse[aria-pressed="true"]').waitFor();
 if(first===alice){await first.locator('#splitDirections').waitFor({state:'visible'});assert.equal(await first.locator('#offset').isDisabled(),true);}
 if(first===bob){await bob.screenshot({path:'output/band-duel-ability-mobile.png',fullPage:true});const b=await bob.locator('#lock').boundingBox();assert(b.y+b.height<=844,'lock control fits the phone viewport');}
 await first.locator('#lock').press('Enter');await second.locator('#lock').waitFor({state:'visible'});await second.locator('#skillUse').click();await second.locator('#skillUse[aria-pressed="true"]').waitFor();
 if(second===bob){await bob.screenshot({path:'output/band-duel-ability-mobile.png',fullPage:true});const b=await bob.locator('#lock').boundingBox();assert(b.y+b.height<=844,'lock control fits the phone viewport');}
 await second.locator('#lock').press('Enter');for(const p of [alice,bob])await p.locator('#next').waitFor({state:'visible'});
 await bob.locator('#resultType').click();await bob.locator('#ownMove').filter({hasText:'蓄能'}).waitFor();await bob.locator('#opponentMove').filter({hasText:'分流'}).waitFor();await bob.locator('#resultInfoClose').click();
 for(const p of [alice,bob])await p.locator('#next').click();await alice.locator('#skillUse').waitFor({state:'visible'});assert.equal(await alice.locator('#skillUse').isDisabled(),true);assert.equal(await bob.locator('#skillUse').isDisabled(),true);
 // Compact phones keep the complete planning controls reachable.
 for(const height of [720,667]){await bob.setViewportSize({width:360,height});const rect=await bob.locator('#planning').boundingBox();assert(rect.y+rect.height<=height+1,'planning controls fit a '+height+'px phone');}
 await bob.setViewportSize({width:390,height:844});
 // Language switching also covers new dynamic screens.
 await bob.locator('#languageToggle').click().catch(async()=>{const button=bob.getByRole('button',{name:/EN \/ CN|切換語言|Switch language/});await button.click();});await bob.locator('#skillUse').filter({hasText:'Used'}).waitFor();await bob.locator('#greetingOpen').click();await bob.locator('#greetingTitle').filter({hasText:'Say hello'}).waitFor();await bob.screenshot({path:'output/band-duel-greetings-mobile.png',fullPage:true});await bob.locator('#greetingClose').click();
 // The same role and ability controls also work through the remote computer API.
 await alice.locator('.topbar>.home-link').click();await alice.locator('#practice').waitFor({state:'visible'});await alice.locator('#practice').click();await alice.locator('#versusContinue').waitFor({state:'visible'});await alice.locator('#versusContinue').click();await alice.locator('[data-character="charge"]').click();await alice.locator('#roleEc').click();await alice.locator('[data-mode="together"]').click();await alice.locator('#coinContinue').waitFor({state:'visible'});await alice.locator('#coinContinue').click();await alice.locator('#lock').waitFor({state:'visible'});await alice.locator('#lock').press('Enter');await alice.locator('#next').waitFor({state:'visible'});await alice.locator('#next').click();await alice.locator('#lock').waitFor({state:'visible'});await alice.locator('#skillUse').click();await alice.locator('#skillUse[aria-pressed="true"]').waitFor();await alice.locator('#lock').press('Enter');await alice.locator('#next').waitFor({state:'visible'});await alice.locator('#resultType').click();await alice.locator('#ownMove').filter({hasText:'蓄能'}).waitFor();
 assert.deepEqual(errors,[]);console.log('Passed: two-player friend consent and invitation, compact/mobile layouts, locked-turn greetings, both abilities, private computer API, replay descriptions, once-only controls and EN/CN.');
}finally{await browser.close();await new Promise(r=>server.close(r));sqlite.close();}
