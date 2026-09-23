CREATE TABLE "fte_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"funding" text NOT NULL,
	"label" text NOT NULL,
	"group_name" text,
	"is_division_subtotal" boolean DEFAULT false NOT NULL,
	"adopted_2026" numeric(10, 2),
	"requested_2027" numeric(10, 2),
	"proposed_2027" numeric(10, 2),
	"change_vs_adopted" numeric(10, 2),
	"change_vs_requested" numeric(10, 2),
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_comparisons" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"section" text NOT NULL,
	"group_path" text[] DEFAULT '{}'::text[] NOT NULL,
	"line" text NOT NULL,
	"adopted_2026" bigint,
	"requested_2027" bigint,
	"proposed_2027" bigint,
	"change_vs_adopted" bigint,
	"change_vs_requested" bigint,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capital_projects" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_facts" ADD COLUMN "lead_with" text;--> statement-breakpoint
ALTER TABLE "budget_facts" ADD COLUMN "table_pair" jsonb;--> statement-breakpoint
ALTER TABLE "budget_facts" ADD COLUMN "also_cite" jsonb;--> statement-breakpoint
ALTER TABLE "capital_projects" ADD COLUMN "amount_text" text;--> statement-breakpoint
ALTER TABLE "capital_projects" ADD COLUMN "amount_from_millions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "capital_projects" ADD COLUMN "pdf_pages" integer[] DEFAULT '{}'::int[] NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "kind" text DEFAULT 'narrative' NOT NULL;--> statement-breakpoint
ALTER TABLE "concepts" ADD COLUMN "occurrences" integer;--> statement-breakpoint
ALTER TABLE "dept_summary" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "dept_summary" ADD COLUMN "change_vs_adopted" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "dept_summary" ADD COLUMN "change_vs_requested" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "dept_summary" ADD COLUMN "flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "dept_summary" ADD COLUMN "label_wrapped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fees" ADD COLUMN "source_text" text;--> statement-breakpoint
ALTER TABLE "fees" ADD COLUMN "narrative_revenue" text;--> statement-breakpoint
ALTER TABLE "fees" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "glossary" ADD COLUMN "cite_text" text;--> statement-breakpoint
ALTER TABLE "glossary" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "glossary" ADD COLUMN "definition_source" text;--> statement-breakpoint
ALTER TABLE "glossary" ADD COLUMN "also_cite" jsonb;--> statement-breakpoint
ALTER TABLE "glossary" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "kpis" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "kpis" ADD COLUMN "flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "section" text NOT NULL;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "is_unit_total" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "footnote_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "position_changes" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "position_changes" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "position_changes" ADD COLUMN "merged_with_previous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD COLUMN "is_division_subtotal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD COLUMN "change_vs_adopted" integer;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD COLUMN "change_vs_requested" integer;--> statement-breakpoint
ALTER TABLE "revenues" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "revenues" ADD COLUMN "is_total" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "revenues" ADD COLUMN "account" text;--> statement-breakpoint
ALTER TABLE "fte_summary" ADD CONSTRAINT "fte_summary_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_comparisons" ADD CONSTRAINT "section_comparisons_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;