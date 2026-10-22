CREATE TABLE `table_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`waiter_id` text NOT NULL,
	`waiter_name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`cash` integer DEFAULT 0 NOT NULL,
	`card` integer DEFAULT 0 NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`business_day` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`updated_at` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `table_bills_waiter_day` ON `table_bills` (`waiter_id`,`business_day`);--> statement-breakpoint
CREATE UNIQUE INDEX table_bills_one_open ON table_bills(table_id) WHERE status='open';
--> statement-breakpoint
CREATE TRIGGER bill_created_audit AFTER INSERT ON table_bills BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),NEW.actor_id,NEW.actor_name,'bill.open','bill',NEW.id,NEW.waiter_id,json_object('table',NEW.table_id,'waiter',NEW.waiter_name),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER bill_updated_audit AFTER UPDATE ON table_bills BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),NEW.actor_id,NEW.actor_name,CASE WHEN NEW.status='closed' THEN 'bill.close' WHEN NEW.status='void' THEN 'bill.void' ELSE 'bill.edit' END,'bill',NEW.id,NEW.waiter_id,json_object('table',NEW.table_id,'before',json_object('total',OLD.total,'status',OLD.status,'items',json(OLD.items),'waiter',OLD.waiter_name),'after',json_object('total',NEW.total,'status',NEW.status,'items',json(NEW.items),'waiter',NEW.waiter_name),'cash',NEW.cash,'card',NEW.card,'reason',NEW.reason),NEW.updated_at);
END;
