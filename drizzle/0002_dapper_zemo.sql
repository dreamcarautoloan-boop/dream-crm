ALTER TABLE `users` ADD `username` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);