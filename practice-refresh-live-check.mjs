import assert from 'node:assert/strict';
import {loadPlaywright} from './scripts/optional-tools.mjs';
const {chromium}=await loadPlaywright();
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];let testPage;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=testPage=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://band-duel.bandduel-game.workers.dev/play',{waitUntil:'domcontentloaded'});await page.locator('#practice').filter({hasText:'練習模式'}).waitFor();
 const profile=await page.locator('#coverProfile').boundingBox(),logo=await page.locator('#coverLogo').boundingBox();assert(profile.y+profile.height<logo.y);
 assert.equal(await page.locator('#leaderboardOpen').innerText(),'積分榜');await page.screenshot({path:'output/band-duel-refresh-live-home.png',fullPage:true});
 await page.locator('#practice').click();await page.locator('#practiceStart').click();await page.locator('#versusContinue').click();await page.locator('#roleEc').click();await page.locator('[data-mode="separate"]').waitFor({state:'visible'});assert.equal(await page.locator('[data-mode]:visible').count(),4);
 await page.locator('[data-mode="separate"]').click();await page.locator('#coinContinue:enabled').click();await page.locator('#offset:enabled').waitFor();
 assert.equal((await page.evaluate(()=>ui.data.clock)).duration,30000);assert((await page.locator('#playGraph').boundingBox()).height>=300);assert.equal(await page.locator('#playGraph foreignObject').count(),2);await page.locator('#lock').scrollIntoViewIfNeeded();assert((await page.locator('#missionCard').boundingBox()).y>=0);
 await page.screenshot({path:'output/band-duel-refresh-live-solo.png',fullPage:true});await page.locator('.topbar>.home-link').click();
 await page.locator('#practice').click();await page.locator('[data-practice-format="2v2"]').click();await page.locator('#practiceStart').click();await page.locator('#teamRoster .avatar-robot').first().waitFor();assert.equal(await page.locator('#teamRoster .avatar-robot').count(),3);
 await page.locator('[data-team-practice-mode="types"]').click();await page.locator('#teamReady').click();await page.locator('#teamStart:enabled').click();await page.locator('#teamLock:enabled').waitFor();let team=await page.evaluate(()=>ui.data);assert.equal(team.mode,'types');assert.equal(team.clock.duration,30000);assert.equal(await page.locator('#teamGraph [data-band-avatar]').count(),4);
 await page.locator('#teamLock').scrollIntoViewIfNeeded();const hud=await page.locator('.battle-hud').boundingBox();assert(hud.y>=0&&hud.y+hud.height<844);await page.screenshot({path:'output/band-duel-refresh-live-team.png',fullPage:true});await page.locator('.topbar>.home-link').click();
 await page.locator('#create').click();await page.locator('[data-room-format="2v2"]').click();assert.equal(await page.locator('#roomSetupRoster .room-slot').count(),4);await page.locator('[data-room-rounds="12"]').click();await page.locator('#roomCreateSubmit').click();await page.locator('#teamRoster').waitFor({state:'visible'});team=await page.evaluate(()=>ui.data);assert.equal(team.roundLimit,12);assert.equal(team.mode,'shuffle');assert.equal(await page.locator('#teamPracticeModes').isVisible(),false);await page.locator('.topbar>.home-link').click();
 assert.deepEqual(errors,[]);console.log('Live passed: clean mobile home, practice pairings, 30-second solo/team clocks, enlarged avatar charts, sticky mission/point HUD, three-CPU 2v2 practice, four-seat 12-round official Shuffle room. Test rooms closed.');
}finally{if(testPage)await testPage.evaluate(async()=>{if(typeof ui!=='undefined'&&ui.data)await leave();}).catch(()=>{});await browser.close();}
