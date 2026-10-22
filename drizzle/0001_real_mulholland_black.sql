CREATE TABLE `staff_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`subject_id` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_activity_time` ON `staff_activity` (`created_at`);--> statement-breakpoint
CREATE INDEX `staff_activity_subject` ON `staff_activity` (`subject_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `staff_revenue` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`day` text NOT NULL,
	`amount` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_revenue_member_day` ON `staff_revenue` (`staff_id`,`day`);--> statement-breakpoint
CREATE TABLE `staff_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_shifts_member_time` ON `staff_shifts` (`staff_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `reservations` ADD `actor_id` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `actor_name` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX staff_shifts_one_open ON staff_shifts(staff_id) WHERE ended_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX staff_revenue_one_day ON staff_revenue(staff_id,day);
--> statement-breakpoint
CREATE TRIGGER reservation_created_audit AFTER INSERT ON reservations BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),coalesce(NEW.actor_id,'guest'),coalesce(NEW.actor_name,'Հյուր'),'reservation.create','reservation',NEW.id,NULL,json_object('status',NEW.status,'table',NEW.table_id),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER reservation_updated_audit AFTER UPDATE ON reservations BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),coalesce(NEW.actor_id,'system'),coalesce(NEW.actor_name,'Համակարգ'),'reservation.update','reservation',NEW.id,NULL,json_object('before',json_object('status',OLD.status,'table',OLD.table_id),'after',json_object('status',NEW.status,'table',NEW.table_id)),NEW.updated_at);
END;
