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