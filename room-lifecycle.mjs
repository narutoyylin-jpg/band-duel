// Claim the public code atomically. Finished matches stay reserved for rematches;
// only closed or expired rooms can be replaced with a fresh identity and token.
export function roomCodeClaimStatement(db,room){
 room.codeClaimTicket=crypto.randomUUID();
 return db.prepare("INSERT INTO duel_rooms (code,version,state,created_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET version=excluded.version,state=excluded.state,created_at=excluded.created_at,expires_at=excluded.expires_at WHERE duel_rooms.expires_at<=excluded.created_at OR json_extract(duel_rooms.state,'$.stage')='closed'")
  .bind(room.code,room.version,JSON.stringify(room),room.createdAt,room.expiresAt);
}
export function roomCodeCleanupStatements(db,room){
 const gate="EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND json_extract(state,'$.codeClaimTicket')=?)",args=[room.code,room.version,room.matchId,room.codeClaimTicket];
 return [
  db.prepare('DELETE FROM duel_match_queue WHERE code=? AND '+gate).bind(room.code,...args),
  db.prepare('DELETE FROM duel_ranked_queue WHERE code=? AND '+gate).bind(room.code,...args),
  db.prepare('DELETE FROM duel_team_queue_members WHERE code=? AND match_id!=? AND '+gate).bind(room.code,room.matchId,...args)
 ];
}
export async function claimRoomCode(db,room){
 const claim=roomCodeClaimStatement(db,room),cleanup=roomCodeCleanupStatements(db,room);
 if(db.batch)return (await db.batch([claim,...cleanup]))[0].meta.changes===1;
 const result=await claim.run();if(result.meta.changes===1)for(const statement of cleanup)await statement.run();return result.meta.changes===1;
}
