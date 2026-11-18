CREATE TABLE `duel_season_closures` (
	`season_id` text PRIMARY KEY NOT NULL,
	`closed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_season_rewards` (
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
--> statement-breakpoint
CREATE INDEX `season_rewards_account` ON `duel_season_rewards` (`account_id`);--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `medals` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `backgrounds` text DEFAULT '["classic"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `background` text DEFAULT 'classic' NOT NULL;