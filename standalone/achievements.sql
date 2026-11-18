CREATE TABLE IF NOT EXISTS duel_achievement_matches (id text PRIMARY KEY NOT NULL, match_id text NOT NULL, account_id text NOT NULL, kind text NOT NULL, outcome text NOT NULL, rounds integer NOT NULL, created_at integer NOT NULL);
CREATE INDEX IF NOT EXISTS achievement_matches_account ON duel_achievement_matches(account_id);
CREATE TABLE IF NOT EXISTS duel_achievement_progress (account_id text PRIMARY KEY NOT NULL, peak_coins integer DEFAULT 0 NOT NULL, peak_rating integer DEFAULT 1000 NOT NULL, updated_at integer NOT NULL);
CREATE TABLE IF NOT EXISTS duel_achievements (id text PRIMARY KEY NOT NULL, account_id text NOT NULL, achievement_id text NOT NULL, unlocked_at integer NOT NULL);
CREATE INDEX IF NOT EXISTS achievements_account ON duel_achievements(account_id);
