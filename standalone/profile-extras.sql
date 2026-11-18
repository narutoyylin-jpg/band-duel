CREATE TABLE IF NOT EXISTS duel_profile_extras (account_id text PRIMARY KEY NOT NULL, country_code text DEFAULT '' NOT NULL, avatar_key text UNIQUE, avatar_image text, updated_at integer NOT NULL);
