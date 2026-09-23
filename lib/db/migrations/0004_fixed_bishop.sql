CREATE TABLE "parcels" (
	"taxkey" text PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"yr_assmt" text,
	"tax_rate_cd" text,
	"house_nr_lo" integer,
	"house_nr_hi" integer,
	"house_nr_sfx" text,
	"sdir" text,
	"street" text,
	"sttype" text,
	"c_a_class" text,
	"c_a_total" bigint,
	"c_a_exm_type" text,
	"c_a_exm_total" bigint,
	"p_a_total" bigint,
	"p_a_exm_total" bigint,
	"nr_units" integer,
	"own_ocpd" text,
	"land_use" text,
	"land_use_gp" text,
	"bldg_type" text,
	"dpw_sanitation" text,
	"geo_alder" text,
	"lot_area" numeric(14, 2),
	"corner_lot" text
);
--> statement-breakpoint
CREATE INDEX "parcels_street_house_idx" ON "parcels" USING btree ("street","house_nr_lo");