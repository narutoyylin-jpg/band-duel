CREATE TABLE `duel_ranked_queue` (
	`code` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`rating` integer NOT NULL,
	`queued_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_ranked_queue_account_id_unique` ON `duel_ranked_queue` (`account_id`);