import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
for(const f of ['lesson.html','phone.html']){
 const ctx=vm.createContext({URLSearchParams,location:{search:'?lang=en'},localStorage:{getItem:()=>null}});vm.runInContext(fs.readFileSync('i18n.js','utf8')+(f==='lesson.html'?'\n'+fs.readFileSync('lesson-i18n.js','utf8'):''),ctx);
 const markup=fs.readFileSync(f,'utf8').replace(/<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>/g,'');
 const values=[...markup.matchAll(/>([^<>]+)</g)].map(m=>m[1]);for(const m of markup.matchAll(/(?:aria-label|alt|placeholder|content)="([^"]+)"/g))values.push(m[1]);
 const missing=values.filter(s=>/[\u4e00-\u9fff]/.test(s)).filter(s=>{ctx.input=s;return /[\u4e00-\u9fff]/.test(vm.runInContext('translated(input)',ctx));});assert.deepEqual(missing,[],f+' untranslated content');
 ctx.input='Create room';vm.runInContext("siteLanguage='cn'",ctx);assert.equal(vm.runInContext('translated(input)',ctx),'建立房間');
}
console.log('Passed: complete static text and accessibility translations on both pages, and clean Chinese lobby labels.');
