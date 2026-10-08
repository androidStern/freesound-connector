declare namespace Cloudflare {
  interface Env {
    FREESOUND_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
