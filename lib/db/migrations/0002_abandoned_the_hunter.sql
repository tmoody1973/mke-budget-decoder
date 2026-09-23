CREATE TABLE "embedding_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"input_type" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
