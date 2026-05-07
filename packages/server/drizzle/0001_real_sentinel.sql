CREATE TABLE `config_entries` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at_ms` integer NOT NULL
);
