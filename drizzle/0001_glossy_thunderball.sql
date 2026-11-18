CREATE TABLE `duel_match_queue` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL
);
