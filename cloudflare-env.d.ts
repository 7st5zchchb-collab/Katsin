declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    STAFF_PASSWORD_HASH?: string;
    STAFF_MANAGER_NAME?: string;
    STAFF_MANAGER_REVOKED_BEFORE?: string;
    STAFF_SESSION_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
