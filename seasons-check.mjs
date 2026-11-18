import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1SeasonStore} from './seasons.mjs';
import {seasonBounds,seasonKey,seasonReward,SEASON_GRACE_MS} from './season-rules.mjs';
import {D1EconomyStore,handleShopRequest} from './economy.mjs';
const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const db={prepare(sql){let v=[];return {bind(...values){v=values;return this;},first(){return sqlite.prepare(sql).get(...v)||null;},all(){return {results:sqlite.prepare(sql).all(...v)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...v).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const seasons=new D1SeasonStore(db),economy=new D1EconomyStore(db),key='2026-10',bounds=seasonBounds(key),now=bounds.end+SEASON_GRACE_MS;
assert.equal(seasonKey(Date.parse('2026-10-31T15:59:59Z')),'2026-10');assert.equal(seasonKey(Date.parse('2026-10-31T16:00:00Z')),'2026-11');assert.equal(seasonKey(Date.parse('2026-12-31T16:00:00Z')),'2027-01');assert.equal(seasonBounds('2028-02').end-seasonBounds('2028-02').start,29*86400000);
const insert=sqlite.prepare('INSERT INTO duel_rated_matches (id,player_id,opponent_id,winner,player_before,opponent_before,player_after,opponent_after,created_at,settled) VALUES (?,?,?,?,1000,1000,?,?,?,?)');
for(let i=0;i<14;i++){
 const account='p'+i,rating=i<2?1600:1600-i*50;await economy.ranking.ensure(account,bounds.start);await economy.ensure('account:'+account);
 for(let n=0;n<10;n++)insert.run(account+'-'+n,account,'rival-'+i+'-'+n,'player',n===9?rating:9999,1000,bounds.start+1000,1);
}
await economy.ranking.ensure('nine',bounds.start);for(let n=0;n<9;n++)insert.run('nine-'+n,'nine','other-'+n,'draw',2000,1000,bounds.start+2000,1);
insert.run('unfinished','nine','other','draw',2000,1000,bounds.start+2000,0);insert.run('self','nine','nine','draw',2000,2000,bounds.start+2000,1);insert.run('old','nine','other','draw',2000,1000,bounds.start-1,1);insert.run('future','nine','other','draw',2000,1000,bounds.end,1);
let current=await seasons.view('p0',bounds.end-1);assert.equal(current.games,10);assert.equal(current.rank,1);assert.equal(current.rating,1600,'last settled rating, not peak or first timestamp tie');assert.equal((await seasons.view('nine',bounds.end-1)).games,9);assert.equal((await seasons.view('nine',bounds.end-1)).rank,null);assert(!JSON.stringify(current).includes('rival-'),'no account identifiers exposed');
assert.equal(await seasons.freeze(key,now-1),false);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_season_rewards').get().n,0);
assert.deepEqual((await Promise.all([seasons.freeze(key,now),seasons.freeze(key,now)])),[true,false]);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_season_rewards').get().n,14);
for(let i=0;i<14;i++){const row=sqlite.prepare('SELECT * FROM duel_season_rewards WHERE account_id=?').get('p'+i),rank=i<2?1:i+1;assert.equal(row.rank,rank);const reward=seasonReward(rank);assert.equal(row.coins,reward.coins);assert.equal(row.medals,reward.medals);assert.equal(row.champion,Number(reward.champion));}
await economy.award('account:p0','old-income',100);await seasons.settleDue(now,'p0');let wallet=await economy.view('account:p0');assert.equal(wallet.coins,600);assert.equal(wallet.medals,150);assert(wallet.owned.includes('season-champion'));assert.equal((await economy.view('account:p1')).coins,0,'account recovery does not partially credit another account');
await Promise.all([seasons.settleDue(now,'p0'),seasons.applyPending('p0',now)]);assert.deepEqual(await economy.view('account:p0'),wallet,'duplicate and concurrent payouts are idempotent');
// A receipt cannot change a frozen placement or cause a second payout.
insert.run('late-retry','p0','late-other','cpu',400,2000,bounds.end-1,1);await seasons.freeze(key,now+1);assert.equal(sqlite.prepare("SELECT rating FROM duel_season_rewards WHERE account_id='p0'").get().rating,1600);
await seasons.applyPending(null,now);assert.equal((await economy.view('account:p1')).medals,150);assert.equal((await economy.view('account:p2')).medals,100);assert.equal((await economy.view('account:p10')).medals,20);assert.equal((await economy.view('account:nine')).coins,0);
const profile=await economy.ranking.board('p0',now);assert(profile.viewer.achievements.items.find(a=>a.id==='season-champion').unlockedAt);assert.equal(profile.viewer.achievements.metrics.peakCoins,600);assert.equal(profile.viewer.achievements.metrics.games,0,'monthly reward is not a completed-game receipt');
await economy.purchaseBackground('account:p0','lattice');wallet=await economy.view('account:p0');assert.equal(wallet.coins,420);assert.equal(wallet.medals,150);
await Promise.all([economy.purchaseBackground('account:p0','coronet'),economy.purchaseBackground('account:p0','coronet')]);wallet=await economy.view('account:p0');assert.equal(wallet.medals,100);assert.equal(wallet.coins,420);assert.equal(wallet.backgrounds.filter(id=>id==='coronet').length,1);await economy.equipBackground('account:p0','coronet');assert.equal((await economy.view('account:p0')).background,'coronet');
await assert.rejects(()=>economy.purchase('account:p0','season-champion'),/限定/);await assert.rejects(()=>economy.equip('account:p0','hole','season-champion'),/電子/);await economy.equip('account:p0','electron','season-champion');await assert.rejects(()=>economy.equipBackground('account:p0','tempest'),/先購買/);await assert.rejects(()=>economy.purchaseBackground('account:nine','orbital'),/金幣不足/);await assert.rejects(()=>economy.purchaseBackground('guest:x','coronet'),/登入/);
let response=await handleShopRequest(new Request('https://test/api/shop/background/buy',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'p0'},body:JSON.stringify({background:'tempest',medals:0})}),economy);assert.equal(response.status,400,'client cannot set prices or balances');
// Next month can award again, while the permanently owned champion is never duplicated.
for(let n=0;n<10;n++)insert.run('nov-'+n,'p0','nov-rival-'+n,'draw',1600,1000,bounds.end+1000,1);
const next=seasonBounds('2026-11').end+SEASON_GRACE_MS;await seasons.settleDue(next);wallet=await economy.view('account:p0');assert.equal(wallet.owned.filter(id=>id==='season-champion').length,1);assert.equal(wallet.medals,250);assert.equal(wallet.background,'coronet');assert.equal((await seasons.view('p0',next)).history.length,2);await seasons.settleDue(next);assert.equal((await economy.view('account:p0')).medals,250);
// Real D1 batches are atomic: an error must roll back the award and receipt together.
sqlite.exec("CREATE TRIGGER reject_payout BEFORE UPDATE OF applied ON duel_season_rewards WHEN NEW.season_id='2026-12' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
for(let n=0;n<10;n++)insert.run('dec-'+n,'p0','dec-rival-'+n,'draw',1600,1000,seasonBounds('2026-12').start+1000,1);
await seasons.freeze('2026-12',seasonBounds('2026-12').end+SEASON_GRACE_MS);await assert.rejects(()=>seasons.applyPending('p0',next),/test rollback/);assert.equal((await economy.view('account:p0')).medals,250);
sqlite.exec('DROP TRIGGER reject_payout');await seasons.applyPending('p0',next);assert.equal((await economy.view('account:p0')).medals,400);
console.log('Passed: Taipei month/year/leap boundaries, receipt-derived 10-game eligibility, tied tiers, atomic/idempotent monthly payouts and rollback, catch-up, permanent champion, separate currencies and background ownership.');
