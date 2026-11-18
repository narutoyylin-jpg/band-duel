CREATE TABLE `duel_players` (
	`account_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`rating` integer DEFAULT 1000 NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_rated_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`winner` text NOT NULL,
	`player_before` integer NOT NULL,
	`opponent_before` integer NOT NULL,
	`player_after` integer NOT NULL,
	`opponent_after` integer NOT NULL,
	`created_at` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);
