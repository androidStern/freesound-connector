CREATE TABLE `freesound_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`stored_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `freesound_cache_expiry` ON `freesound_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `freesound_cache_age` ON `freesound_cache` (`stored_at`);