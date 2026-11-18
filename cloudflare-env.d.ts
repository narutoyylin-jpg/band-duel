declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AUTH_MODE?: string;
    GOOGLE_CLIENT_ID?: string;
    BAND_DUEL_SESSION_SECRET?: string;
  }
}
