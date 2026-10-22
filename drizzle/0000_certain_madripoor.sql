CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`guests` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reservation_availability` ON `reservations` (`table_id`,`start`,`end`,`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
