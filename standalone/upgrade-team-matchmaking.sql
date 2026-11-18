CREATE TABLE IF NOT EXISTS `duel_rating_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`format` text NOT NULL,
	`winner` text NOT NULL,
	`participants` text NOT NULL,
	`created_at` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `duel_rating_events_match_id_unique` ON `duel_rating_events` (`match_id`);
CREATE INDEX IF NOT EXISTS `rating_events_month` ON `duel_rating_events` (`created_at`);
CREATE TABLE IF NOT EXISTS `duel_team_queue_members` (
	`identity` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`match_id` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `team_queue_code` ON `duel_team_queue_members` (`code`);
INSERT INTO duel_rating_events (match_id,format,winner,participants,created_at,settled) SELECT id,'1v1',winner,json_array(json_object('accountId',player_id,'before',player_before,'after',player_after),json_object('accountId',opponent_id,'before',opponent_before,'after',opponent_after)),created_at,1 FROM duel_rated_matches WHERE settled=1 AND player_id<>opponent_id ORDER BY created_at,rowid ON CONFLICT(match_id) DO NOTHING;
