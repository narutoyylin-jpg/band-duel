CREATE TABLE `duel_chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`client_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_conversation_order` ON `duel_chat_messages` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `chat_recipient_unread` ON `duel_chat_messages` (`recipient_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_sender_client` ON `duel_chat_messages` (`sender_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `duel_chat_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`peer_id` text NOT NULL,
	`last_read_id` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_reads_pair` ON `duel_chat_reads` (`account_id`,`peer_id`);--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `music` text DEFAULT '["quiet-orbit","band-clash"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `home_music` text DEFAULT 'quiet-orbit' NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_wallets` ADD `duel_music` text DEFAULT 'band-clash' NOT NULL;