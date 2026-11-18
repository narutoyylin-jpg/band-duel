CREATE TABLE `duel_profile_extras` (
	`account_id` text PRIMARY KEY NOT NULL,
	`country_code` text DEFAULT '' NOT NULL,
	`avatar_key` text,
	`avatar_image` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_profile_extras_avatar_key_unique` ON `duel_profile_extras` (`avatar_key`);