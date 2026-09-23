CREATE TABLE "chat_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"questions" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- The app's read-only role (production) may count chat questions here and nowhere else. Skipped
-- where the role doesn't exist (local or test databases).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reader') THEN
    GRANT SELECT, INSERT, UPDATE ON "chat_usage" TO app_reader;
  END IF;
END $$;
