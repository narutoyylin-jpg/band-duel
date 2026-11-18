CREATE TABLE `duel_rating_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`format` text NOT NULL,
	`winner` text NOT NULL,
	`participants` text NOT NULL,
	`created_at` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_rating_events_match_id_unique` ON `duel_rating_events` (`match_id`);--> statement-breakpoint
CREATE INDEX `rating_events_month` ON `duel_rating_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `duel_team_queue_members` (
	`identity` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`match_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_queue_code` ON `duel_team_queue_members` (`code`);