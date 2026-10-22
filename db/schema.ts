import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const reservations = sqliteTable("reservations", {
 id:text("id").primaryKey(), tableId:text("table_id").notNull(), start:integer("start").notNull(), end:integer("end").notNull(), guests:integer("guests").notNull(), name:text("name").notNull(), phone:text("phone").notNull(), note:text("note").notNull().default(""), status:text("status").notNull().default("pending"), createdAt:integer("created_at").notNull(), actorId:text("actor_id"), actorName:text("actor_name"), updatedAt:integer("updated_at").notNull().default(0),
},(t)=>[index("reservation_availability").on(t.tableId,t.start,t.end,t.status)]);
export const settings=sqliteTable("settings",{key:text("key").primaryKey(),value:text("value").notNull()});

export const staffShifts=sqliteTable('staff_shifts',{
 id:text('id').primaryKey(),staffId:text('staff_id').notNull(),startedAt:integer('started_at').notNull(),endedAt:integer('ended_at'),updatedAt:integer('updated_at').notNull(),actorId:text('actor_id'),actorName:text('actor_name'),reason:text('reason').notNull().default(''),
},t=>[index('staff_shifts_member_time').on(t.staffId,t.startedAt)]);
export const staffRevenue=sqliteTable('staff_revenue',{
 id:text('id').primaryKey(),staffId:text('staff_id').notNull(),day:text('day').notNull(),amount:integer('amount').notNull(),updatedAt:integer('updated_at').notNull(),updatedBy:text('updated_by').notNull(),updatedName:text('updated_name').notNull(),revision:integer('revision').notNull().default(1),reason:text('reason').notNull().default(''),
},t=>[index('staff_revenue_member_day').on(t.staffId,t.day)]);
export const staffActivity=sqliteTable('staff_activity',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),action:text('action').notNull(),entityType:text('entity_type').notNull(),entityId:text('entity_id').notNull(),subjectId:text('subject_id'),details:text('details').notNull().default('{}'),createdAt:integer('created_at').notNull(),
},t=>[index('staff_activity_time').on(t.createdAt),index('staff_activity_subject').on(t.subjectId,t.createdAt)]);

export const tableBills=sqliteTable('table_bills',{
 id:text('id').primaryKey(),tableId:text('table_id').notNull(),waiterId:text('waiter_id').notNull(),waiterName:text('waiter_name').notNull(),status:text('status').notNull().default('open'),items:text('items').notNull().default('[]'),total:integer('total').notNull().default(0),cash:integer('cash').notNull().default(0),card:integer('card').notNull().default(0),openedAt:integer('opened_at').notNull(),closedAt:integer('closed_at'),businessDay:text('business_day'),revision:integer('revision').notNull().default(1),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),updatedAt:integer('updated_at').notNull(),reason:text('reason').notNull().default(''),
},t=>[index('table_bills_waiter_day').on(t.waiterId,t.businessDay)]);
