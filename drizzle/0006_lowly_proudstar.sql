CREATE TABLE `duel_achievement_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`outcome` text NOT NULL,
	`rounds` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `achievement_matches_account` ON `duel_achievement_matches` (`account_id`);--> statement-breakpoint
CREATE TABLE `duel_achievement_progress` (
	`account_id` text PRIMARY KEY NOT NULL,
	`peak_coins` integer DEFAULT 0 NOT NULL,
	`peak_rating` integer DEFAULT 1000 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `achievements_account` ON `duel_achievements` (`account_id`);