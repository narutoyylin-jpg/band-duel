import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {carrierModel,goalsForMode} from './duel-core.mjs';
for(const file of ['lesson.html','phone.html']){
 const html=fs.readFileSync(file,'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.length,1);scripts.forEach(s=>new vm.Script(s));
 const markup=html.replace(/<script>[\s\S]*?<\/script>/g,''),ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 const dynamic=new Set(['demoEc','demoEv','demoEcValue','demoEvValue','demoResult','tutorialGraph','tutorialTeamGraph','demoCaption']);for(const [,id] of scripts[0].matchAll(/\$\('([\w-]+)'\)/g))assert(ids.includes(id)||dynamic.has(id),file+' missing element '+id);
 if(file==='lesson.html'){
  assert(!/id="(?:roomPanel|battlePanel|battleControls|exploreMode)"/.test(markup));assert(html.includes('/phone-entry-qr.png'));assert(!html.includes('create_duel_room'));
  const calculate=vm.runInNewContext('const KBT=8.617333262e-5*300;function calculate'+scripts[0].split('function calculate')[1].split('function renderImpact')[0]+';calculate');
  for(const [ec,ev] of [[-.12,.1],[.12,-.1],[-.12,-.1],[.12,.1],[0,0],[0,.1]]){const r=carrierModel(ec,ev),ui=calculate(ec,ev);for(const k of ['type','eSide','hSide','electronB','holeB'])assert.equal(ui[k],r[k]);}
 }else{assert(!/起点|对方|计分|双人/.test(html));for(const topic of ['before','bands','types','controls','reveal','scoring'])assert(html.includes('data-tutorial="'+topic+'"'));for(const sourceFile of ['phone.js','phone-tutorial.js','phone-tutorial-animation.js'])assert(html.includes(fs.readFileSync(sourceFile,'utf8').trim()),'phone embeds current '+sourceFile);}
}
for(let i=0;i<100;i++){
 const types=goalsForMode('types');assert.notEqual(types.player.type,types.cpu.type);for(const q of Object.values(types)){assert.equal(q.eSide,null);assert.equal(q.hSide,null);}
 for(const mode of ['together','separate']){const g=goalsForMode(mode);assert.equal(g.player.type,g.cpu.type);assert.notEqual(g.player.eSide,g.cpu.eSide);assert.notEqual(g.player.hSide,g.cpu.hSide);}
 const shuffle=goalsForMode('shuffle');assert.notEqual(shuffle.player.id,shuffle.cpu.id);
}
assert(fs.statSync('public/phone-entry-qr.png').size>0);
console.log('Passed: standalone lesson/phone scripts and controls, Type/side assignments, teaching physics and QR asset.');
