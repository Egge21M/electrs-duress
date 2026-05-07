CREATE TABLE `xpub_watch_sources` (
	`xpub` text PRIMARY KEY NOT NULL,
	`label` text,
	`address_count` integer NOT NULL,
	`enabled` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
