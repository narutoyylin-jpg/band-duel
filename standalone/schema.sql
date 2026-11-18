CREATE TABLE IF NOT EXISTS duel_rooms (code text PRIMARY KEY NOT NULL, version integer DEFAULT 0 NOT NULL, state text NOT NULL, created_at integer NOT NULL, expires_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_match_queue (id integer PRIMARY KEY NOT NULL, code text NOT NULL, expires_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_players (account_id text PRIMARY KEY NOT NULL, display_name text NOT NULL, avatar_id text DEFAULT 'orb' NOT NULL, rating integer DEFAULT 1000 NOT NULL, games integer DEFAULT 0 NOT NULL, wins integer DEFAULT 0 NOT NULL, losses integer DEFAULT 0 NOT NULL, draws integer DEFAULT 0 NOT NULL, version integer DEFAULT 0 NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_rated_matches (id text PRIMARY KEY NOT NULL, player_id text NOT NULL, opponent_id text NOT NULL, winner text NOT NULL, player_before integer NOT NULL, opponent_before integer NOT NULL, player_after integer NOT NULL, opponent_after integer NOT NULL, created_at integer NOT NULL, settled integer DEFAULT 0 NOT NULL);
CREATE TABLE IF NOT EXISTS duel_coin_receipts (id text PRIMARY KEY NOT NULL, wallet_id text NOT NULL, amount integer NOT NULL, applied integer DEFAULT 0 NOT NULL, created_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_computer_matches (id text PRIMARY KEY NOT NULL, wallet_id text NOT NULL, state text NOT NULL, receipt text, version integer DEFAULT 0 NOT NULL, expires_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_wallets (
`music` text DEFAULT '["quiet-orbit","band-clash"]' NOT NULL,
`home_music` text DEFAULT 'quiet-orbit' NOT NULL,
`duel_music` text DEFAULT 'band-clash' NOT NULL,id text PRIMARY KEY NOT NULL, coins integer DEFAULT 0 NOT NULL, inventory text DEFAULT '["classic"]' NOT NULL, medals integer DEFAULT 0 NOT NULL, backgrounds text DEFAULT '["classic"]' NOT NULL, background text DEFAULT 'classic' NOT NULL, electron text DEFAULT 'classic' NOT NULL, hole text DEFAULT 'classic' NOT NULL, version integer DEFAULT 0 NOT NULL, updated_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_profile_extras (account_id text PRIMARY KEY NOT NULL, country_code text DEFAULT '' NOT NULL, avatar_key text UNIQUE, avatar_image text, avatar_background text DEFAULT 'midnight' NOT NULL, updated_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_achievement_matches (id text PRIMARY KEY NOT NULL, match_id text NOT NULL, account_id text NOT NULL, kind text NOT NULL, outcome text NOT NULL, rounds integer NOT NULL, created_at integer NOT NULL);
CREATE INDEX IF NOT EXISTS achievement_matches_account ON duel_achievement_matches(account_id);
CREATE TABLE IF NOT EXISTS duel_achievement_progress (account_id text PRIMARY KEY NOT NULL, peak_coins integer DEFAULT 0 NOT NULL, peak_rating integer DEFAULT 1000 NOT NULL, updated_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_achievements (id text PRIMARY KEY NOT NULL, account_id text NOT NULL, achievement_id text NOT NULL, unlocked_at integer NOT NULL);
CREATE INDEX IF NOT EXISTS achievements_account ON duel_achievements(account_id);

CREATE TABLE IF NOT EXISTS duel_ranked_queue (code text PRIMARY KEY NOT NULL,account_id text NOT NULL UNIQUE,rating integer NOT NULL,queued_at integer NOT NULL,expires_at integer NOT NULL);


CREATE TABLE IF NOT EXISTS `duel_season_closures` (
	`season_id` text PRIMARY KEY NOT NULL,
	`closed_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `duel_season_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`account_id` text NOT NULL,
	`rank` integer NOT NULL,
	`rating` integer NOT NULL,
	`games` integer NOT NULL,
	`coins` integer NOT NULL,
	`medals` integer NOT NULL,
	`champion` integer DEFAULT 0 NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`awarded_at` integer
);

CREATE INDEX IF NOT EXISTS `season_rewards_account` ON `duel_season_rewards` (`account_id`);

CREATE TABLE IF NOT EXISTS `duel_friend_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`room_code` text NOT NULL,
	`match_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `friend_invites_recipient` ON `duel_friend_invites` (`recipient_id`);
CREATE TABLE IF NOT EXISTS `duel_friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`account_a` text NOT NULL,
	`account_b` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `friends_account_a` ON `duel_friendships` (`account_a`);
CREATE INDEX IF NOT EXISTS `friends_account_b` ON `duel_friendships` (`account_b`);
CREATE TABLE IF NOT EXISTS `duel_social_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `social_blocks_owner` ON `duel_social_blocks` (`blocker_id`);
CREATE TABLE IF NOT EXISTS `duel_social_profiles` (
	`account_id` text PRIMARY KEY NOT NULL,
	`player_code` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `duel_social_profiles_player_code_unique` ON `duel_social_profiles` (`player_code`);
CREATE TABLE IF NOT EXISTS `duel_chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`client_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `chat_conversation_order` ON `duel_chat_messages` (`conversation_id`,`id`);
CREATE INDEX IF NOT EXISTS `chat_recipient_unread` ON `duel_chat_messages` (`recipient_id`,`id`);
CREATE UNIQUE INDEX IF NOT EXISTS `chat_sender_client` ON `duel_chat_messages` (`sender_id`,`client_id`);
CREATE TABLE IF NOT EXISTS `duel_chat_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`peer_id` text NOT NULL,
	`last_read_id` integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `chat_reads_pair` ON `duel_chat_reads` (`account_id`,`peer_id`);



CREATE TABLE `duel_rating_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`format` text NOT NULL,
	`winner` text NOT NULL,
	`participants` text NOT NULL,
	`created_at` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX `duel_rating_events_match_id_unique` ON `duel_rating_events` (`match_id`);
CREATE INDEX `rating_events_month` ON `duel_rating_events` (`created_at`);
CREATE TABLE `duel_team_queue_members` (
	`identity` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`match_id` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE INDEX `team_queue_code` ON `duel_team_queue_members` (`code`);