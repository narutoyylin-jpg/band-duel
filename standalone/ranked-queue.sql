CREATE TABLE IF NOT EXISTS duel_ranked_queue (code text PRIMARY KEY NOT NULL,account_id text NOT NULL UNIQUE,rating integer NOT NULL,queued_at integer NOT NULL,expires_at integer NOT NULL);
