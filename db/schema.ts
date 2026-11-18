import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const duelRooms=sqliteTable('duel_rooms',{
  code:text('code').primaryKey(),
  version:integer('version').notNull().default(0),
  state:text('state').notNull(),
  createdAt:integer('created_at').notNull(),
  expiresAt:integer('expires_at').notNull()
});
export const duelMatchQueue=sqliteTable('duel_match_queue',{
  id:integer('id').primaryKey(),
  code:text('code').notNull(),
  expiresAt:integer('expires_at').notNull()
});
export const duelPlayers=sqliteTable('duel_players',{
  accountId:text('account_id').primaryKey(),
  displayName:text('display_name').notNull(),
  avatarId:text('avatar_id').notNull().default('orb'),
  rating:integer('rating').notNull().default(1000),
  games:integer('games').notNull().default(0),
  wins:integer('wins').notNull().default(0),
  losses:integer('losses').notNull().default(0),
  draws:integer('draws').notNull().default(0),
  version:integer('version').notNull().default(0),
  createdAt:integer('created_at').notNull(),
  updatedAt:integer('updated_at').notNull()
});
export const duelProfileExtras=sqliteTable('duel_profile_extras',{
  accountId:text('account_id').primaryKey(),countryCode:text('country_code').notNull().default(''),
  avatarKey:text('avatar_key').unique(),avatarImage:text('avatar_image'),avatarBackground:text('avatar_background').notNull().default('midnight'),updatedAt:integer('updated_at').notNull()
});
export const duelRatedMatches=sqliteTable('duel_rated_matches',{
  id:text('id').primaryKey(),
  playerId:text('player_id').notNull(),
  opponentId:text('opponent_id').notNull(),
  winner:text('winner').notNull(),
  playerBefore:integer('player_before').notNull(),
  opponentBefore:integer('opponent_before').notNull(),
  playerAfter:integer('player_after').notNull(),
  opponentAfter:integer('opponent_after').notNull(),
  createdAt:integer('created_at').notNull(),
  settled:integer('settled').notNull().default(0)
});
export const duelWallets=sqliteTable('duel_wallets',{
  id:text('id').primaryKey(),coins:integer('coins').notNull().default(0),
  medals:integer('medals').notNull().default(0),backgrounds:text('backgrounds').notNull().default('["classic"]'),background:text('background').notNull().default('classic'),
  inventory:text('inventory').notNull().default('["classic"]'),
  electron:text('electron').notNull().default('classic'),hole:text('hole').notNull().default('classic'),
  music:text('music').notNull().default('["quiet-orbit","band-clash"]'),homeMusic:text('home_music').notNull().default('quiet-orbit'),duelMusic:text('duel_music').notNull().default('band-clash'),
  version:integer('version').notNull().default(0),updatedAt:integer('updated_at').notNull()
});
export const duelCoinReceipts=sqliteTable('duel_coin_receipts',{
  id:text('id').primaryKey(),walletId:text('wallet_id').notNull(),amount:integer('amount').notNull(),
  applied:integer('applied').notNull().default(0),createdAt:integer('created_at').notNull()
});
export const duelComputerMatches=sqliteTable('duel_computer_matches',{
  id:text('id').primaryKey(),walletId:text('wallet_id').notNull(),state:text('state').notNull(),
  receipt:text('receipt'),version:integer('version').notNull().default(0),expiresAt:integer('expires_at').notNull()
});
export const duelAchievementMatches=sqliteTable('duel_achievement_matches',{
  id:text('id').primaryKey(),matchId:text('match_id').notNull(),accountId:text('account_id').notNull(),
  kind:text('kind').notNull(),outcome:text('outcome').notNull(),rounds:integer('rounds').notNull(),createdAt:integer('created_at').notNull()
},table=>[index('achievement_matches_account').on(table.accountId)]);
export const duelAchievementProgress=sqliteTable('duel_achievement_progress',{
  accountId:text('account_id').primaryKey(),peakCoins:integer('peak_coins').notNull().default(0),peakRating:integer('peak_rating').notNull().default(1000),updatedAt:integer('updated_at').notNull()
});
export const duelAchievements=sqliteTable('duel_achievements',{
  id:text('id').primaryKey(),accountId:text('account_id').notNull(),achievementId:text('achievement_id').notNull(),unlockedAt:integer('unlocked_at').notNull()
},table=>[index('achievements_account').on(table.accountId)]);
export const duelRankedQueue=sqliteTable('duel_ranked_queue',{
  code:text('code').primaryKey(),accountId:text('account_id').notNull().unique(),rating:integer('rating').notNull(),queuedAt:integer('queued_at').notNull(),expiresAt:integer('expires_at').notNull()
});
export const duelSeasonClosures=sqliteTable('duel_season_closures',{
  seasonId:text('season_id').primaryKey(),closedAt:integer('closed_at').notNull()
});
export const duelSeasonRewards=sqliteTable('duel_season_rewards',{
  id:text('id').primaryKey(),seasonId:text('season_id').notNull(),accountId:text('account_id').notNull(),rank:integer('rank').notNull(),
  rating:integer('rating').notNull(),games:integer('games').notNull(),coins:integer('coins').notNull(),medals:integer('medals').notNull(),
  champion:integer('champion').notNull().default(0),applied:integer('applied').notNull().default(0),createdAt:integer('created_at').notNull(),awardedAt:integer('awarded_at')
},table=>[index('season_rewards_account').on(table.accountId)]);
export const duelSocialProfiles=sqliteTable('duel_social_profiles',{
  accountId:text('account_id').primaryKey(),playerCode:text('player_code').notNull().unique(),createdAt:integer('created_at').notNull()
});
export const duelFriendships=sqliteTable('duel_friendships',{
  id:text('id').primaryKey(),accountA:text('account_a').notNull(),accountB:text('account_b').notNull(),requestedBy:text('requested_by').notNull(),status:text('status').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},table=>[index('friends_account_a').on(table.accountA),index('friends_account_b').on(table.accountB)]);
export const duelSocialBlocks=sqliteTable('duel_social_blocks',{
  id:text('id').primaryKey(),blockerId:text('blocker_id').notNull(),blockedId:text('blocked_id').notNull(),createdAt:integer('created_at').notNull()
},table=>[index('social_blocks_owner').on(table.blockerId)]);
export const duelFriendInvites=sqliteTable('duel_friend_invites',{
  id:text('id').primaryKey(),senderId:text('sender_id').notNull(),recipientId:text('recipient_id').notNull(),roomCode:text('room_code').notNull(),matchId:text('match_id').notNull(),status:text('status').notNull(),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull()
},table=>[index('friend_invites_recipient').on(table.recipientId)]);
export const duelChatMessages=sqliteTable('duel_chat_messages',{
  id:integer('id').primaryKey({autoIncrement:true}),conversationId:text('conversation_id').notNull(),senderId:text('sender_id').notNull(),recipientId:text('recipient_id').notNull(),clientId:text('client_id').notNull(),text:text('text').notNull(),createdAt:integer('created_at').notNull()
},table=>[index('chat_conversation_order').on(table.conversationId,table.id),index('chat_recipient_unread').on(table.recipientId,table.id),uniqueIndex('chat_sender_client').on(table.senderId,table.clientId)]);
export const duelChatReads=sqliteTable('duel_chat_reads',{
  id:text('id').primaryKey(),accountId:text('account_id').notNull(),peerId:text('peer_id').notNull(),lastReadId:integer('last_read_id').notNull().default(0)
},table=>[uniqueIndex('chat_reads_pair').on(table.accountId,table.peerId)]);
export const duelTeamQueueMembers=sqliteTable('duel_team_queue_members',{
  identity:text('identity').primaryKey(),code:text('code').notNull(),matchId:text('match_id').notNull(),expiresAt:integer('expires_at').notNull()
},table=>[index('team_queue_code').on(table.code)]);
export const duelRatingEvents=sqliteTable('duel_rating_events',{
  id:integer('id').primaryKey({autoIncrement:true}),matchId:text('match_id').notNull().unique(),format:text('format').notNull(),winner:text('winner').notNull(),participants:text('participants').notNull(),createdAt:integer('created_at').notNull(),settled:integer('settled').notNull().default(0)
},table=>[index('rating_events_month').on(table.createdAt)]);
