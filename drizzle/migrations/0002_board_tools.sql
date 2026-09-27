-- The drop table was already created by the handwritten 0001 migration.
CREATE TABLE `pomodoro` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`seconds` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pomodoro_user_completed` ON `pomodoro` (`user_id`,`completed_at`);--> statement-breakpoint
ALTER TABLE `tab` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `label` text DEFAULT '' NOT NULL;
