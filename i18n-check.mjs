import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const languageSource=fs.readFileSync('i18n.js','utf8');
for(const test of [
 {query:'?install=1',languages:['en-US'],expected:'en'},
 {query:'?install=1',languages:['zh-TW','en-US'],expected:'cn'},
 {query:'?install=1',languages:['de-DE','en-GB'],expected:'en'},
 {query:'?install=1',languages:['fr-FR'],expected:'cn'},
 {query:'?install=1',saved:'cn',languages:['en-US'],expected:'cn'},
 {query:'?install=1',saved:'en',languages:['zh-TW'],expected:'en'},
 {query:'?install=1&lang=zh-Hant',saved:'en',languages:['en-US'],expected:'cn'},
 {query:'?install=1&lang=en',saved:'cn',languages:['zh-TW'],expected:'en'},
 {query:'?install=1&lang=invalid',saved:'en',languages:['zh-TW'],expected:'en'},
 {query:'?install=1',storageBlocked:true,languages:['en-US'],expected:'en'},
]){
 const writes=[],replacements=[],document={createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],getElementById:()=>null,documentElement:{},dispatchEvent(){}};
 const context=vm.createContext({URLSearchParams,URL,location:{search:test.query,href:'https://game.test/play'+test.query},navigator:{languages:test.languages},localStorage:{getItem(){if(test.storageBlocked)throw Error('blocked');return test.saved||null;},setItem:(...args)=>writes.push(args)},document,NodeFilter:{SHOW_TEXT:4},CustomEvent:class{},history:{replaceState:(...args)=>replacements.push(args)}});
 vm.runInContext(languageSource,context);assert.equal(vm.runInContext('siteLanguage',context),test.expected,'language priority '+JSON.stringify(test));
 vm.runInContext("setSiteLanguage('en')",context);assert.deepEqual(writes,[['band-language','en']],'chosen guide language is remembered');assert.equal(document.documentElement.lang,'en');
 if(test.query.includes('lang=')){assert.equal(replacements.length,1);assert.equal(replacements[0][2].searchParams.get('lang'),'en');assert.equal(replacements[0][2].searchParams.get('install'),'1','language switch preserves QR entry');}
}
for(const f of ['lesson.html','phone.html']){
 const ctx=vm.createContext({URLSearchParams,location:{search:'?lang=en'},localStorage:{getItem:()=>null}});vm.runInContext(fs.readFileSync('i18n.js','utf8')+(f==='lesson.html'?'\n'+fs.readFileSync('lesson-i18n.js','utf8'):''),ctx);
 const markup=fs.readFileSync(f,'utf8').replace(/<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>/g,'');
 const values=[...markup.matchAll(/>([^<>]+)</g)].map(m=>m[1]);for(const m of markup.matchAll(/(?:aria-label|alt|placeholder|content)="([^"]+)"/g))values.push(m[1]);
 const missing=values.filter(s=>/[\u4e00-\u9fff]/.test(s)).filter(s=>{ctx.input=s;return /[\u4e00-\u9fff]/.test(vm.runInContext('translated(input)',ctx));});assert.deepEqual(missing,[],f+' untranslated content');
 ctx.input='Create room';vm.runInContext("siteLanguage='cn'",ctx);assert.equal(vm.runInContext('translated(input)',ctx),'建立房間');
}
console.log('Passed: QR/default language priority, stored choice and blocked-storage fallback, complete static text and accessibility translations on both pages, and clean Chinese lobby labels.');
