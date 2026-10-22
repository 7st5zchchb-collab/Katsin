ALTER TABLE `staff_revenue` ADD `reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_shifts` ADD `actor_id` text;--> statement-breakpoint
ALTER TABLE `staff_shifts` ADD `actor_name` text;--> statement-breakpoint
ALTER TABLE `staff_shifts` ADD `reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TRIGGER shift_started_audit AFTER INSERT ON staff_shifts BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),coalesce(NEW.actor_id,NEW.staff_id),coalesce(NEW.actor_name,'Աշխատակից'),'shift.start','shift',NEW.id,NEW.staff_id,json_object('startedAt',NEW.started_at),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER shift_updated_audit AFTER UPDATE ON staff_shifts BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),coalesce(NEW.actor_id,NEW.staff_id),coalesce(NEW.actor_name,'Աշխատակից'),CASE WHEN NEW.reason='' THEN 'shift.end' ELSE 'shift.edit' END,'shift',NEW.id,NEW.staff_id,json_object('before',json_object('startedAt',OLD.started_at,'endedAt',OLD.ended_at),'after',json_object('startedAt',NEW.started_at,'endedAt',NEW.ended_at),'reason',NEW.reason),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER revenue_created_audit AFTER INSERT ON staff_revenue BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_name,'revenue.set','revenue',NEW.id,NEW.staff_id,json_object('day',NEW.day,'amount',NEW.amount,'reason',NEW.reason),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER revenue_updated_audit AFTER UPDATE ON staff_revenue BEGIN
 INSERT INTO staff_activity(id,actor_id,actor_name,action,entity_type,entity_id,subject_id,details,created_at) VALUES(lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_name,'revenue.edit','revenue',NEW.id,NEW.staff_id,json_object('day',NEW.day,'before',OLD.amount,'after',NEW.amount,'reason',NEW.reason),NEW.updated_at);
END;
