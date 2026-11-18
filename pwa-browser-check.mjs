import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('phone-install.js','utf8');
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ';
const mac='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ';
const android='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ';
const windows='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ';
const safari='Version/18.0 Mobile/15E148 Safari/604.1';
const chrome='Chrome/130.0.0.0 Safari/537.36';
const cases=[
  {name:'iPhone Safari',ua:iphone+safari,browser:'safari',ios:true,guide:true,title:/iPhone · Safari/,steps:/Safari 工具列/},
  {name:'iPhone Chrome',ua:iphone+'CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',browser:'chrome',ios:true,guide:true,title:/iPhone · Chrome/,steps:/Chrome 網址列/},
  {name:'iPad Safari desktop UA',ua:mac+'Version/18.0 Safari/605.1.15',platform:'MacIntel',touch:5,browser:'safari',ios:true,guide:true,title:/iPad · Safari/,steps:/Safari 工具列/},
  {name:'Android Chrome',ua:android+'Chrome/130.0.0.0 Mobile Safari/537.36',browser:'chrome',title:/Android · Chrome/,steps:/安裝並建立捷徑/},
  {name:'Windows Chrome',ua:windows+chrome,browser:'chrome',title:/Windows · Chrome/,steps:/投放、儲存及分享/},
  {name:'macOS Chrome',ua:mac+chrome,platform:'MacIntel',browser:'chrome',title:/macOS · Chrome/,steps:/投放、儲存及分享/},
  {name:'macOS Safari',ua:mac+'Version/18.0 Safari/605.1.15',platform:'MacIntel',browser:'safari',title:/macOS · Safari/,steps:/加入 Dock/},
  {name:'Edge cannot be Chrome',ua:windows+chrome+' Edg/130.0.0.0',browser:'edge',title:/Windows · Edge/,steps:/目前瀏覽器選單/},
  {name:'Samsung cannot be Chrome',ua:android+'SamsungBrowser/26.0 Chrome/130.0.0.0 Mobile Safari/537.36',browser:'samsung',title:/Android · Samsung Internet/,steps:/目前瀏覽器選單/},
  {name:'iOS Firefox fallback',ua:iphone+'FxiOS/130.0 Mobile/15E148 Safari/605.1.15',browser:'firefox',ios:true,title:/iPhone · Firefox/,steps:/請用 Safari 或 Chrome/},
  {name:'LINE embedded Safari fallback',ua:iphone+safari+' Line/14.0',browser:'embedded',ios:true,title:/App 內建瀏覽器/,steps:/在瀏覽器開啟/},
  {name:'Google App cannot be Chrome',ua:iphone+'Chrome/130.0.0.0 Mobile Safari/604.1 GSA/330.0',browser:'embedded',ios:true,title:/App 內建瀏覽器/,steps:/在瀏覽器開啟/},
  {name:'Android WebView fallback',ua:'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',browser:'embedded',title:/App 內建瀏覽器/,steps:/在瀏覽器開啟/},
  {name:'Unknown browser fallback',ua:'Unknown/1',browser:'other',title:/目前瀏覽器/,steps:/目前瀏覽器選單/},
];
for(const test of cases){
  const nodes=new Map(),events={},media={matches:false,addEventListener(){}};let lang='zh',prompts=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,textContent:'',events:{},focus(){},select(){},addEventListener(key,fn){this.events[key]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
  const context=vm.createContext({URLSearchParams,$:node,tx:(zh,en)=>lang==='zh'?zh:en,matchMedia:()=>media,window:{addEventListener:(key,fn)=>events[key]=fn},document:{addEventListener(){}},navigator:{userAgent:test.ua,platform:test.platform||'',maxTouchPoints:test.touch||0},location:{protocol:'https:',origin:'https://game.test',search:'?install=1&private=secret'},closeAnimatedDialog:el=>el.close(),updateCoverMotion(){}});
  vm.runInContext(source+'\ninitInstall();',context);
  const device=vm.runInContext('installEnvironment()',context);
  assert.equal(device.browser,test.browser,test.name+' browser');assert.equal(device.ios,!!test.ios,test.name+' OS');
  assert.equal(node('installDialog').open,true,test.name+' QR opens guide');
  assert.equal(node('installIosPanel').hidden,!test.guide,test.name+' iOS guide');
  assert.equal(node('installAndroidGuide').hidden,!!test.guide,test.name+' manual guide');
  assert.match(node('installPlatformHint').textContent,test.title,test.name+' label');
  assert.match(node(test.guide?'installIosShareText':'installAndroidSteps').textContent,test.steps,test.name+' steps');
  assert.equal(node('installNative').hidden,true,'no assumed native support');
  assert.equal(node('installUrl').value,'https://game.test/play?install=1','copied URL excludes private parameters');
  events.beforeinstallprompt({preventDefault(){},prompt:async()=>{prompts++;},userChoice:Promise.resolve({outcome:'dismissed'})});
  assert.equal(prompts,0,'prompt waits for user action');
  assert.equal(node('installNative').hidden,!!test.ios||device.embedded,test.name+' native availability');
  await vm.runInContext('promptInstall()',context);
  assert.equal(prompts,test.ios||device.embedded?0:1,test.name+' prompt trigger');
  if(!test.ios&&!device.embedded)assert.equal(node('installNative').hidden,true,'dismissed prompt cleared');
  lang='en';vm.runInContext('renderInstall()',context);
  assert.doesNotMatch(node('installIntro').textContent,/[\u4e00-\u9fff]/,test.name+' English intro');
  assert.doesNotMatch(node(test.guide?'installIosShareText':'installAndroidSteps').textContent,/[\u4e00-\u9fff]/,test.name+' English steps');
  media.matches=true;vm.runInContext('renderInstall()',context);assert.equal(node('installApp').hidden,true,test.name+' installed entry hidden');
}
console.log(`Passed: ${cases.length} browser/OS combinations, matching installation instructions, native prompt capability and user action, language switching, and installed-app state.`);
