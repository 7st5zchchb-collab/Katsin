CREATE INDEX `reservation_status_time` ON `reservations` (`status`,`start`,`end`,`table_id`);--> statement-breakpoint
CREATE INDEX `reservation_history_time` ON `reservations` (`start`,`id`);