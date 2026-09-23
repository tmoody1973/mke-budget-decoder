CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "amendments" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"number" text NOT NULL,
	"sponsor" text,
	"dept_id" integer,
	"description" text NOT NULL,
	"amount_change" bigint,
	"status" text,
	"legistar_url" text
);
--> statement-breakpoint
CREATE TABLE "budget_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"topic" text NOT NULL,
	"statement" text NOT NULL,
	"value" numeric(16, 2),
	"unit" text,
	"reviewed_by" text,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"fiscal_year" smallint NOT NULL,
	"stage" text NOT NULL,
	"run_label" text NOT NULL,
	"published_at" date,
	CONSTRAINT "budget_versions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capital_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer,
	"name" text NOT NULL,
	"amount" bigint,
	"description" text,
	"category" text,
	"place_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"doc_id" integer,
	"dept_id" integer,
	"region" text,
	"section_type" text NOT NULL,
	"heading" text,
	"ordinal" smallint,
	"text" text NOT NULL,
	"context_header" text NOT NULL,
	"pdf_page" smallint NOT NULL,
	"page_end" smallint,
	"printed_page" text NOT NULL,
	"parent_section_id" text,
	"linked_tables" text[] DEFAULT '{}'::text[] NOT NULL,
	"embedding" vector(1024),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "chunks"."context_header" || ' ' || "chunks"."text")) STORED
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"code" text,
	"dept_ids" integer[] DEFAULT '{}'::int[] NOT NULL,
	"gloss" text,
	"gloss_reviewed" boolean DEFAULT false NOT NULL,
	"embedding" vector(1024),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "concepts"."label" || ' ' || coalesce("concepts"."gloss", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"section" text NOT NULL,
	"parent_id" integer,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dept_crosswalk" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	"summary_pdf_page_start" smallint NOT NULL,
	"summary_pdf_page_end" smallint NOT NULL,
	"detailed_page_prefix" text,
	"org_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"fund_codes" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dept_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	"metric" text NOT NULL,
	"label" text NOT NULL,
	"actual_2025" numeric(14, 2),
	"adopted_2026" numeric(14, 2),
	"requested_2027" numeric(14, 2),
	"proposed_2027" numeric(14, 2),
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"file_path" text NOT NULL,
	"source_url" text,
	"page_offset" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"fee" text NOT NULL,
	"unit" text NOT NULL,
	"value_2026" numeric(12, 2),
	"value_2027" numeric(12, 2),
	"pct_change" numeric(6, 2),
	"revenue_2027" bigint,
	"is_derived" boolean DEFAULT false NOT NULL,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossary" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"term" text NOT NULL,
	"plain_definition" text NOT NULL,
	"why_it_matters" text,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	"measure" text NOT NULL,
	"col_labels" text[] NOT NULL,
	"values" text[] NOT NULL,
	"footnote" text,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer,
	"row_type" text NOT NULL,
	"block" text,
	"fund" text,
	"org" text,
	"sbcl" text,
	"account" text,
	"category" text,
	"hierarchy_path" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text NOT NULL,
	"description_raw" text NOT NULL,
	"pay_range" text,
	"actual_2025" bigint,
	"adopted_2026_units" numeric(10, 2),
	"adopted_2026" bigint,
	"requested_2027_units" numeric(10, 2),
	"requested_2027" bigint,
	"proposed_2027_units" numeric(10, 2),
	"proposed_2027" bigint,
	"is_subtotal" boolean DEFAULT false NOT NULL,
	"is_position" boolean DEFAULT false NOT NULL,
	"is_deduction" boolean DEFAULT false NOT NULL,
	"footnote_flag" boolean DEFAULT false NOT NULL,
	"note" text,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mprop_parcels" (
	"taxkey" text PRIMARY KEY NOT NULL,
	"yr_assmt" smallint NOT NULL,
	"house_nr_lo" integer,
	"house_nr_hi" integer,
	"house_nr_sfx" text,
	"sdir" text,
	"street" text,
	"sttype" text,
	"unit" text,
	"c_a_total" bigint,
	"c_a_exm_total" bigint,
	"p_a_total" bigint,
	"p_a_exm_total" bigint,
	"c_a_class" text,
	"land_use" text,
	"land_use_gp" text,
	"bldg_type" text,
	"nr_units" integer,
	"own_ocpd" text,
	"tax_rate_cd" text,
	"dpw_sanitation" text,
	"geo_alder" text,
	"lot_area" integer,
	"corner_lot" text,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	"positions" numeric(10, 2),
	"om_ftes" numeric(10, 2),
	"non_om_ftes" numeric(10, 2),
	"title" text NOT NULL,
	"reason" text,
	"reason_category" text,
	"is_total" boolean DEFAULT false NOT NULL,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"line_item_id" integer,
	"dept_id" integer,
	"title" text NOT NULL,
	"footnote_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"pay_range" text,
	"hierarchy_path" text[] DEFAULT '{}'::text[] NOT NULL,
	"adopted_2026_units" numeric(10, 2),
	"adopted_2026" bigint,
	"requested_2027_units" numeric(10, 2),
	"requested_2027" bigint,
	"proposed_2027_units" numeric(10, 2),
	"proposed_2027" bigint,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer,
	"label" text NOT NULL,
	"adopted_2026" integer,
	"requested_2027" integer,
	"proposed_2027" integer,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenues" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"fund" text,
	"dept_id" integer,
	"category" text,
	"subcategory" text,
	"line" text NOT NULL,
	"actual_2025" bigint,
	"adopted_2026" bigint,
	"requested_2027" bigint,
	"proposed_2027" bigint,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_totals" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"section" text NOT NULL,
	"label" text NOT NULL,
	"line" text NOT NULL,
	"adopted_2026" bigint,
	"proposed_2027" bigint,
	"change" bigint,
	"tax_rate_2026" numeric(8, 2),
	"tax_rate_2027" numeric(8, 2),
	"tax_rate_change" numeric(8, 2),
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_version_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	"description" text NOT NULL,
	"operating" bigint,
	"capital" bigint,
	"grant" bigint,
	"ftes" numeric(10, 2),
	"is_total" boolean DEFAULT false NOT NULL,
	"cite" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_facts" ADD CONSTRAINT "budget_facts_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_projects" ADD CONSTRAINT "capital_projects_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_projects" ADD CONSTRAINT "capital_projects_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dept_crosswalk" ADD CONSTRAINT "dept_crosswalk_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dept_crosswalk" ADD CONSTRAINT "dept_crosswalk_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dept_summary" ADD CONSTRAINT "dept_summary_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dept_summary" ADD CONSTRAINT "dept_summary_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary" ADD CONSTRAINT "glossary_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_changes" ADD CONSTRAINT "position_changes_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_changes" ADD CONSTRAINT "position_changes_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_lines" ADD CONSTRAINT "position_lines_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_lines" ADD CONSTRAINT "position_lines_line_item_id_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_lines" ADD CONSTRAINT "position_lines_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD CONSTRAINT "positions_summary_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions_summary" ADD CONSTRAINT "positions_summary_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_totals" ADD CONSTRAINT "section_totals_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_embedding" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_tsv" ON "chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "chunks_dept" ON "chunks" USING btree ("dept_id");--> statement-breakpoint
CREATE INDEX "concepts_embedding" ON "concepts" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "concepts_tsv" ON "concepts" USING gin ("tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_version_slug" ON "departments" USING btree ("budget_version_id","slug");--> statement-breakpoint
CREATE INDEX "line_items_dept" ON "line_items" USING btree ("dept_id");--> statement-breakpoint
CREATE INDEX "line_items_account" ON "line_items" USING btree ("account");--> statement-breakpoint
CREATE INDEX "position_lines_title" ON "position_lines" USING btree ("title");