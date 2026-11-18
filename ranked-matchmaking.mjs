export const rankedSearchRange=waitMs=>Math.min(1000,150+Math.floor(Math.max(0,waitMs)/15000)*50);
export class D1RankedMatchmaker{
  constructor(store){this.store=store;this.db=store.db;}
  async enqueue(r,profile,now){
    await this.cleanup(now);
    const existing=await this.db.prepare('SELECT code FROM duel_ranked_queue WHERE account_id=?').bind(profile.account_id).first();
    if(existing)throw Error('你已有一場等待中的牌位配對，請先取消。');
    await this.db.prepare('INSERT INTO duel_ranked_queue (code,account_id,rating,queued_at,expires_at) VALUES (?,?,?,?,?)').bind(r.code,profile.account_id,profile.rating,now,r.expiresAt).run();
  }
  async cleanup(now){await this.db.prepare("DELETE FROM duel_ranked_queue WHERE expires_at<=? OR NOT EXISTS(SELECT 1 FROM duel_rooms r WHERE r.code=duel_ranked_queue.code AND json_extract(r.state,'$.matchKind')='ranked' AND json_extract(r.state,'$.players.player')=duel_ranked_queue.account_id AND json_extract(r.state,'$.stage')='lobby')").bind(now).run();}
  async count(now){return Number((await this.db.prepare("SELECT COUNT(*) n FROM duel_ranked_queue q JOIN duel_rooms r ON r.code=q.code WHERE q.expires_at>? AND json_extract(r.state,'$.matchKind')='ranked' AND json_extract(r.state,'$.players.player')=q.account_id AND json_extract(r.state,'$.stage')='lobby'").bind(now).first())?.n||0);}
  async pair(r,now){
    if(r.matchKind!=='ranked'||r.stage!=='lobby')return;
    const me=await this.db.prepare('SELECT * FROM duel_ranked_queue WHERE code=? AND account_id=? AND expires_at>?').bind(r.code,r.players.player,now).first();if(!me)return;
    const candidates=await this.db.prepare("SELECT q.* FROM duel_ranked_queue q JOIN duel_rooms r ON r.code=q.code WHERE q.code!=? AND q.account_id!=? AND q.expires_at>? AND json_extract(r.state,'$.matchKind')='ranked' AND json_extract(r.state,'$.players.player')=q.account_id AND json_extract(r.state,'$.stage')='lobby' ORDER BY ABS(q.rating-?),q.queued_at,q.code LIMIT 100").bind(r.code,me.account_id,now,me.rating).all();
    for(const peer of candidates.results){
      const gap=Math.abs(me.rating-peer.rating);if(gap>Math.min(rankedSearchRange(now-me.queued_at),rankedSearchRange(now-peer.queued_at)))continue;
      const older=me.queued_at<peer.queued_at||me.queued_at===peer.queued_at&&me.code<peer.code;
      const [host,guest]=await Promise.all([this.store.get(older?me.code:peer.code),this.store.get(older?peer.code:me.code)]);
      if(!host||!guest||host.matchKind!=='ranked'||guest.matchKind!=='ranked'||host.stage!=='lobby'||guest.stage!=='lobby'||!host.players.player||!guest.players.player||host.players.player===guest.players.player)continue;
      const hostVersion=host.version,guestVersion=guest.version,guestHash=guest.seats.player;
      host.seats.cpu=guestHash;host.players.cpu=guest.players.player;host.names.cpu=guest.names.player;host.profiles.cpu=guest.profiles.player;host.wallets.cpu=guest.wallets.player;host.skins.cpu=guest.skins.player;
      host.ranked=true;host.rankingReason='rated';host.stage='role';host.version++;
      guest.stage='redirect';guest.redirectCode=host.code;guest.redirectMatchId=host.matchId;guest.version++;
      // One transaction claims both queue entries. A guest cannot join two hosts during concurrent polls.
      const gate="EXISTS(SELECT 1 FROM duel_rooms h WHERE h.code=? AND json_extract(h.state,'$.seats.cpu')=? AND json_extract(h.state,'$.matchId')=?)";
      const results=await this.db.batch([
        this.db.prepare("UPDATE duel_rooms SET state=?,version=? WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND json_extract(state,'$.matchKind')='ranked' AND json_extract(state,'$.stage')='lobby' AND EXISTS(SELECT 1 FROM duel_rooms g WHERE g.code=? AND g.version=? AND json_extract(g.state,'$.matchId')=? AND json_extract(g.state,'$.matchKind')='ranked' AND json_extract(g.state,'$.stage')='lobby') AND EXISTS(SELECT 1 FROM duel_ranked_queue WHERE code=? AND account_id=? AND expires_at>?) AND EXISTS(SELECT 1 FROM duel_ranked_queue WHERE code=? AND account_id=? AND expires_at>?)").bind(JSON.stringify(host),host.version,host.code,hostVersion,host.matchId,guest.code,guestVersion,guest.matchId,host.code,host.players.player,now,guest.code,guest.players.player,now),
        this.db.prepare("UPDATE duel_rooms SET state=?,version=? WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND "+gate).bind(JSON.stringify(guest),guest.version,guest.code,guestVersion,guest.matchId,host.code,guestHash,host.matchId),
        this.db.prepare('DELETE FROM duel_ranked_queue WHERE code IN (?,?) AND '+gate).bind(host.code,guest.code,host.code,guestHash,host.matchId)
      ]);
      if(results[0].meta.changes===1)return;
      const current=await this.store.get(r.code);if(current?.stage!=='lobby')return;
    }
  }
}
