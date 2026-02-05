CREATE TABLE "calendar_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"type" varchar(20) DEFAULT 'custom' NOT NULL,
	"user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"onedrive_folder_id" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_synced" timestamp,
	"sync_errors" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"taken_at" timestamp,
	"external_id" varchar(255),
	"thumbnail_path" varchar(255),
	"favorite" boolean DEFAULT false NOT NULL,
	"orientation" varchar(20),
	"usage" varchar(100) DEFAULT 'wallpaper,gallery,screensaver' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "birthdays" DROP CONSTRAINT "birthdays_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chore_completions" DROP CONSTRAINT "chore_completions_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chore_completions" DROP CONSTRAINT "chore_completions_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chores" DROP CONSTRAINT "chores_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chores" DROP CONSTRAINT "chores_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "family_messages" DROP CONSTRAINT "family_messages_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "layouts" DROP CONSTRAINT "layouts_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_completions" DROP CONSTRAINT "maintenance_completions_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_reminders" DROP CONSTRAINT "maintenance_reminders_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_reminders" DROP CONSTRAINT "maintenance_reminders_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_cooked_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shopping_items" DROP CONSTRAINT "shopping_items_added_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "birthdays" ADD COLUMN "event_type" varchar(20) DEFAULT 'birthday' NOT NULL;--> statement-breakpoint
ALTER TABLE "birthdays" ADD COLUMN "google_calendar_source" varchar(50);--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD COLUMN "is_family" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "calendar_groups" ADD CONSTRAINT "calendar_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_source_id_photo_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."photo_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_groups_type_idx" ON "calendar_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "photos_source_id_idx" ON "photos" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "photos_taken_at_idx" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "photos_favorite_idx" ON "photos" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "photos_usage_idx" ON "photos" USING btree ("usage");--> statement-breakpoint
ALTER TABLE "birthdays" ADD CONSTRAINT "birthdays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_group_id_calendar_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."calendar_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_completions" ADD CONSTRAINT "maintenance_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_cooked_by_users_id_fk" FOREIGN KEY ("cooked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "birthdays_name_event_type_idx" ON "birthdays" USING btree ("name","event_type");--> statement-breakpoint
CREATE INDEX "calendar_sources_enabled_idx" ON "calendar_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "chore_completions_approved_by_idx" ON "chore_completions" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "chore_completions_chore_approved_by_idx" ON "chore_completions" USING btree ("chore_id","approved_by");--> statement-breakpoint
CREATE INDEX "chores_assigned_to_idx" ON "chores" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "family_messages_expires_at_idx" ON "family_messages" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shopping_items_checked_idx" ON "shopping_items" USING btree ("checked");--> statement-breakpoint
CREATE INDEX "tasks_completed_idx" ON "tasks" USING btree ("completed");