import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** One bounded cache shared by all authorized clients of this Site. */
export const freesoundCache = sqliteTable("freesound_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  storedAt: integer("stored_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("freesound_cache_expiry").on(table.expiresAt), index("freesound_cache_age").on(table.storedAt)]);
