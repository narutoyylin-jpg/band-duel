CREATE TABLE `duel_coin_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`amount` integer NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_computer_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`state` text NOT NULL,
	`receipt` text,
	`version` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `duel_wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`inventory` text DEFAULT '["classic"]' NOT NULL,
	`electron` text DEFAULT 'classic' NOT NULL,
	`hole` text DEFAULT 'classic' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
