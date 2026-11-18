import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {standaloneLesson} from './lesson-standalone.mjs';
const html=standaloneLesson(fs.readFileSync('lesson.html','utf8'));
assert(!html.includes('ChatGPT')&&!html.includes('chatgpt.site'));
assert(!/<section class="phone-entry/.test(html));assert(html.includes('href="/play"'));assert(html.includes('href="/lab?download=1"'));
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
const live=process.argv.includes('--live'),serve=process.argv.includes('--serve');let server;
if(!live){server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/lab'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',...(url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="heterojunction-interactive.html"'}:{})});res.end(html);return;}
 if(url.pathname==='/play'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync('phone.html'));return;}
 const root=path.resolve('public'),file=path.resolve(root,'.'+url.pathname);if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});res.end(fs.readFileSync(file));}else{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(serve?4187:0,'127.0.0.1',r));}
const origin=live?'https://heterojunction-band-lab.opeuertio.chatgpt.site':'http://127.0.0.1:'+server.address().port;
if(serve){console.log('Local: '+origin+'/lab');await new Promise(()=>{});}
import {loadPlaywright} from './scripts/optional-tools.mjs';
const {chromium}=await loadPlaywright();
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+(live?'/':'/lab'));
 assert.equal(new URL(page.url()).pathname,live?'/':'/lab');await page.locator('#bandDiagram path').first().waitFor({state:'attached'});assert.equal(await page.locator('.phone-entry').count(),0);assert.equal(await page.locator('.lesson-product-nav a:last-child').count(),1);
 await page.locator('[data-preset="together-b"]').click();assert.equal(await page.locator('#typeLabel').innerText(),'Type I');
 await page.locator('[data-preset="separate"]').click();assert.equal(await page.locator('#typeLabel').innerText(),'Type II');
 const strong=await page.evaluate(()=>calculate(state.ec,state.ev).electronB);await page.locator('[data-experiment="weak"]').click();const weak=await page.evaluate(()=>calculate(state.ec,state.ev).electronB);assert(weak<strong&&weak>.5);
 await page.locator('#languageToggle').click();assert.equal(await page.locator('.lesson-product-nav [aria-current]').innerText(),'Band principles');await page.locator('#languageToggle').click();await page.locator('#reset').click();await page.screenshot({path:'output/band-lab-'+(live?'live':'local')+'-desktop.png',fullPage:true});
 const download=await context.request.get(origin+(live?'/?download=1':'/lab?download=1'));assert.equal(download.status(),200);assert(download.headers()['content-disposition'].includes('attachment'));assert((await download.text()).includes('function calculate'));
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/band-lab-'+(live?'live':'local')+'-mobile.png',fullPage:true});
 if(live){await page.locator('.lesson-product-nav a:last-child').click();await page.locator('#practice').waitFor();await page.locator('#homeMore>summary').click();assert.equal(await page.locator('#homeLearn,a[href^="/lab"]').count(),0,'game offers no link back to the lab');assert.equal(new URL(page.url()).pathname,'/play');}
 assert.deepEqual(errors,[]);console.log((live?'Live':'Local')+' passed: independent teaching entry, Type I/II examples, interactive carrier distribution, EN/CN, offline download, responsive layout'+(live?' and lab-to-game navigation without a game-to-lab entry.':'.'));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
