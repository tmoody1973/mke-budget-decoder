// Drizzle schema — docs/02 §4, plus docs/05 (fees, budget_facts, reason_category, place_tags)
// and docs/06 (concepts, dept_crosswalk). Every budget table carries budget_version_id so the
// Adopted budget loads beside Proposed in November without a migration (decision D8).
//
// Conventions:
//   money   → bigint (integer dollars; the all-funds total $2.26B overflows int4)
//   FTEs    → numeric(10,2)
//   blank   → NULL, never 0 (a blank cell means "not in this stage", not zero)
//   cite    → jsonb {doc, pdf_page, printed_page, line_no?}; on every row because OpenUI
//             Query() hands tool rows straight to components, so each row must carry its own source.
import { sql, type SQL } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core'

export type Cite = {
  doc: 'summary' | 'detailed'
  pdf_page: number
  printed_page: string
  line_no?: number
}

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

const money = (name: string) => bigint(name, { mode: 'number' })
const fte = (name: string) => numeric(name, { precision: 10, scale: 2 })
const cite = () => jsonb('cite').$type<Cite>().notNull()

// voyage-4 default output is 1024 dims (docs.voyageai.com/docs/embeddings, checked 2026-09-23).
const EMBEDDING_DIMS = 1024

export const budgetVersions = pgTable('budget_versions', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(), // '2027-proposed-3rd-run-2026-09-14'
  fiscalYear: smallint('fiscal_year').notNull(),
  stage: text('stage', { enum: ['proposed', 'adopted'] }).notNull(),
  runLabel: text('run_label').notNull(), // '3rd Run 9/14/26' from the Detailed footer
  publishedAt: date('published_at'),
})

const versionId = () =>
  integer('budget_version_id')
    .notNull()
    .references(() => budgetVersions.id)

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  kind: text('kind', { enum: ['summary', 'detailed'] }).notNull(),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  sourceUrl: text('source_url'),
  pageOffset: smallint('page_offset').notNull().default(0), // Summary: printed = pdf - 10
})

export const departments = pgTable(
  'departments',
  {
    id: serial('id').primaryKey(),
    budgetVersionId: versionId(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name'),
    section: text('section').notNull(), // 'A'..'N'
    parentId: integer('parent_id'), // DPW divisions → DPW
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [uniqueIndex('departments_version_slug').on(t.budgetVersionId, t.slug)],
)

const deptId = () => integer('dept_id').references(() => departments.id)

export const deptCrosswalk = pgTable('dept_crosswalk', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId().notNull(),
  summaryPdfPageStart: smallint('summary_pdf_page_start').notNull(),
  summaryPdfPageEnd: smallint('summary_pdf_page_end').notNull(),
  detailedPagePrefix: text('detailed_page_prefix'), // '300' for Police
  orgCodes: text('org_codes').array().notNull().default(sql`'{}'::text[]`),
  fundCodes: text('fund_codes').array().notNull().default(sql`'{}'::text[]`),
})

export const sectionTotals = pgTable('section_totals', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  section: text('section').notNull(), // 'A'..'N', or 'subtotal'/'total' as printed
  label: text('label').notNull(),
  line: text('line', { enum: ['budget', 'non_levy', 'levy'] }).notNull(),
  adopted2026: money('adopted_2026'),
  proposed2027: money('proposed_2027'),
  change: money('change'),
  taxRate2026: numeric('tax_rate_2026', { precision: 8, scale: 2 }),
  taxRate2027: numeric('tax_rate_2027', { precision: 8, scale: 2 }),
  taxRateChange: numeric('tax_rate_change', { precision: 8, scale: 2 }),
  cite: cite(),
})

export const deptSummary = pgTable('dept_summary', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId().notNull(),
  // fte_om, fte_other, positions, salaries, fringe, operating, equipment, special_funds,
  // total_expenditures, rev_<category>, rev_total
  metric: text('metric').notNull(),
  label: text('label').notNull(), // as printed
  groupName: text('group_name'), // printed block/group: personnel | expenditures | revenues | source of funds | …
  actual2025: numeric('actual_2025', { precision: 14, scale: 2 }),
  adopted2026: numeric('adopted_2026', { precision: 14, scale: 2 }),
  requested2027: numeric('requested_2027', { precision: 14, scale: 2 }),
  proposed2027: numeric('proposed_2027', { precision: 14, scale: 2 }),
  changeVsAdopted: numeric('change_vs_adopted', { precision: 14, scale: 2 }), // as printed (may disagree: source_inconsistencies)
  changeVsRequested: numeric('change_vs_requested', { precision: 14, scale: 2 }),
  flags: text('flags').array().notNull().default(sql`'{}'::text[]`), // e.g. printed_bracketed:actual_2025 (Summary p.187)
  labelWrapped: boolean('label_wrapped').notNull().default(false),
  cite: cite(),
})

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId().notNull(),
  description: text('description').notNull(),
  operating: money('operating'),
  capital: money('capital'),
  grant: money('grant'),
  ftes: fte('ftes'),
  isTotal: boolean('is_total').notNull().default(false),
  cite: cite(),
})

export const kpis = pgTable('kpis', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId().notNull(),
  measure: text('measure').notNull(),
  groupName: text('group_name'), // parent measure when sub-measures were printed as bullets (Fire p.92)
  colLabels: text('col_labels').array().notNull(), // as printed: 2024 Actual | 2025 Projected | 2026 Planned
  values: text('values').array().notNull(), // as printed, not coerced
  footnote: text('footnote'),
  flags: text('flags').array().notNull().default(sql`'{}'::text[]`),
  cite: cite(),
})

export const positionChanges = pgTable('position_changes', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId().notNull(),
  positions: numeric('positions', { precision: 10, scale: 2 }),
  omFtes: fte('om_ftes'),
  nonOmFtes: fte('non_om_ftes'),
  title: text('title').notNull(),
  section: text('section'), // heading printed inside the table (DPW-ISD 'Transportation Infrastructure')
  groupName: text('group_name'),
  reason: text('reason'),
  reasonCategory: text('reason_category', {
    enum: [
      'vacant_elimination',
      'arpa_sunset',
      'grant_change',
      'reclassification',
      'new_funded',
      'transfer',
      'contract_to_city',
      'other',
    ],
  }),
  isTotal: boolean('is_total').notNull().default(false),
  mergedWithPrevious: boolean('merged_with_previous').notNull().default(false),
  cite: cite(),
})

export const capitalProjects = pgTable('capital_projects', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId(),
  name: text('name'), // null when the document prints no name (a sentence, not a bullet) — never invented
  amount: money('amount'),
  amountText: text('amount_text'), // as printed, e.g. '($2.0 million)'
  amountFromMillions: boolean('amount_from_millions').notNull().default(false),
  description: text('description'),
  category: text('category'),
  placeTags: text('place_tags').array().notNull().default(sql`'{}'::text[]`),
  pdfPages: integer('pdf_pages').array().notNull().default(sql`'{}'::int[]`), // item may cross a page break
  cite: cite(),
})

export const lineItems = pgTable(
  'line_items',
  {
    id: serial('id').primaryKey(),
    budgetVersionId: versionId(),
    deptId: deptId(),
    // heading | account | rollup | count | position | adjustment | deduction | note
    rowType: text('row_type').notNull(),
    // bcu_summary rows restate their decision units — never sum across both blocks
    block: text('block', { enum: ['bcu_summary', 'decision_unit'] }),
    fund: text('fund'),
    org: text('org'),
    sbcl: text('sbcl'),
    account: text('account'),
    category: text('category'),
    hierarchyPath: text('hierarchy_path').array().notNull().default(sql`'{}'::text[]`),
    description: text('description').notNull(),
    descriptionRaw: text('description_raw').notNull(), // before footnote-marker stripping
    payRange: text('pay_range'),
    actual2025: money('actual_2025'),
    adopted2026Units: fte('adopted_2026_units'),
    adopted2026: money('adopted_2026'),
    requested2027Units: fte('requested_2027_units'),
    requested2027: money('requested_2027'),
    proposed2027Units: fte('proposed_2027_units'),
    proposed2027: money('proposed_2027'),
    section: text('section').notNull(), // Detailed page-id prefix, e.g. '300'
    isSubtotal: boolean('is_subtotal').notNull().default(false),
    isUnitTotal: boolean('is_unit_total').notNull().default(false),
    isPosition: boolean('is_position').notNull().default(false),
    isDeduction: boolean('is_deduction').notNull().default(false),
    footnoteFlag: boolean('footnote_flag').notNull().default(false),
    footnoteCodes: text('footnote_codes').array().notNull().default(sql`'{}'::text[]`),
    flags: text('flags').array().notNull().default(sql`'{}'::text[]`),
    note: text('note'),
    cite: cite(),
  },
  (t) => [
    index('line_items_dept').on(t.deptId),
    index('line_items_account').on(t.account),
  ],
)

export const positionLines = pgTable(
  'position_lines',
  {
    id: serial('id').primaryKey(),
    budgetVersionId: versionId(),
    lineItemId: integer('line_item_id').references(() => lineItems.id),
    deptId: deptId(),
    title: text('title').notNull(),
    footnoteCodes: text('footnote_codes').array().notNull().default(sql`'{}'::text[]`),
    payRange: text('pay_range'),
    hierarchyPath: text('hierarchy_path').array().notNull().default(sql`'{}'::text[]`),
    adopted2026Units: fte('adopted_2026_units'),
    adopted2026: money('adopted_2026'),
    requested2027Units: fte('requested_2027_units'),
    requested2027: money('requested_2027'),
    proposed2027Units: fte('proposed_2027_units'),
    proposed2027: money('proposed_2027'),
    cite: cite(),
  },
  (t) => [index('position_lines_title').on(t.title)],
)

export const revenues = pgTable('revenues', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  source: text('source', { enum: ['summary', 'detailed'] }).notNull(),
  isTotal: boolean('is_total').notNull().default(false),
  account: text('account'),
  fund: text('fund'),
  deptId: deptId(),
  category: text('category'),
  subcategory: text('subcategory'),
  line: text('line').notNull(),
  actual2025: money('actual_2025'),
  adopted2026: money('adopted_2026'),
  requested2027: money('requested_2027'),
  proposed2027: money('proposed_2027'),
  cite: cite(),
})

export const positionsSummary = pgTable('positions_summary', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  deptId: deptId(), // null for the printed total row
  label: text('label').notNull(),
  groupName: text('group_name'),
  isDivisionSubtotal: boolean('is_division_subtotal').notNull().default(false), // DPW '(1,608)' is a subtotal, not negative
  adopted2026: integer('adopted_2026'),
  requested2027: integer('requested_2027'),
  proposed2027: integer('proposed_2027'),
  changeVsAdopted: integer('change_vs_adopted'),
  changeVsRequested: integer('change_vs_requested'),
  cite: cite(),
})

export const glossary = pgTable('glossary', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  term: text('term').notNull(),
  plainDefinition: text('plain_definition').notNull(),
  whyItMatters: text('why_it_matters'),
  citeText: text('cite_text'),
  aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  definitionSource: text('definition_source'), // 'ours' = the document never defines the term
  alsoCite: jsonb('also_cite'),
  reviewedBy: text('reviewed_by'),
  cite: cite(),
})

export const chunks = pgTable(
  'chunks',
  {
    id: text('id').primaryKey(), // 'department:police:service_highlight:1'
    budgetVersionId: versionId(),
    docId: integer('doc_id').references(() => documents.id),
    deptId: deptId(),
    region: text('region'),
    kind: text('kind', { enum: ['narrative', 'table_card', 'chart_card'] }).notNull().default('narrative'),
    sectionType: text('section_type').notNull(),
    heading: text('heading'),
    ordinal: smallint('ordinal'),
    text: text('text').notNull(),
    contextHeader: text('context_header').notNull(),
    pdfPage: smallint('pdf_page').notNull(),
    pageEnd: smallint('page_end'),
    printedPage: text('printed_page').notNull(),
    parentSectionId: text('parent_section_id'),
    linkedTables: text('linked_tables').array().notNull().default(sql`'{}'::text[]`),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }),
    tsv: tsvector('tsv').generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${chunks.contextHeader} || ' ' || ${chunks.text})`,
    ),
  },
  (t) => [
    index('chunks_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv').using('gin', t.tsv),
    index('chunks_dept').on(t.deptId),
  ],
)

export const concepts = pgTable(
  'concepts',
  {
    id: serial('id').primaryKey(),
    budgetVersionId: versionId(),
    kind: text('kind', {
      enum: ['account', 'position_title', 'org_unit', 'capital_line', 'revenue_line'],
    }).notNull(),
    label: text('label').notNull(), // as printed
    code: text('code'),
    deptIds: integer('dept_ids').array().notNull().default(sql`'{}'::int[]`),
    occurrences: integer('occurrences'),
    gloss: text('gloss'),
    glossReviewed: boolean('gloss_reviewed').notNull().default(false),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }),
    tsv: tsvector('tsv').generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${concepts.label} || ' ' || coalesce(${concepts.gloss}, ''))`,
    ),
  },
  (t) => [
    index('concepts_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('concepts_tsv').using('gin', t.tsv),
  ],
)

export const fees = pgTable('fees', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  fee: text('fee').notNull(), // 'solid_waste' | 'extra_cart' | 'snow_ice' | …
  unit: text('unit').notNull(), // 'per_year_per_unit' | 'per_frontage_ft' | 'avg_household_per_year'
  value2026: numeric('value_2026', { precision: 12, scale: 2 }),
  value2027: numeric('value_2027', { precision: 12, scale: 2 }),
  pctChange: numeric('pct_change', { precision: 6, scale: 2 }),
  revenue2027: money('revenue_2027'),
  isDerived: boolean('is_derived').notNull().default(false),
  sourceText: text('source_text'),
  narrativeRevenue: text('narrative_revenue'),
  reviewedBy: text('reviewed_by'),
  cite: cite(),
})

export const budgetFacts = pgTable('budget_facts', {
  id: text('id').primaryKey(),
  budgetVersionId: versionId(),
  topic: text('topic').notNull(),
  statement: text('statement').notNull(), // neutral, close to document wording
  value: numeric('value', { precision: 16, scale: 2 }),
  unit: text('unit'),
  reviewedBy: text('reviewed_by'), // null until a human reviews it
  leadWith: text('lead_with'), // 'table' = show the table figure first (docs/06 §7)
  context: text('context'), // our sentence shown beside the quote, e.g. how two figures reconcile
  tablePair: jsonb('table_pair'),
  alsoCite: jsonb('also_cite'),
  cite: cite(),
})

// Summary p.8-10 'Comparisons by Budget Sections'
export const sectionComparisons = pgTable('section_comparisons', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  section: text('section').notNull(),
  groupPath: text('group_path').array().notNull().default(sql`'{}'::text[]`),
  line: text('line').notNull(),
  adopted2026: money('adopted_2026'),
  requested2027: money('requested_2027'),
  proposed2027: money('proposed_2027'),
  changeVsAdopted: money('change_vs_adopted'),
  changeVsRequested: money('change_vs_requested'),
  cite: cite(),
})

// Summary p.14-16 estimated FTEs by department and funding
export const fteSummary = pgTable('fte_summary', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  funding: text('funding', { enum: ['om', 'non_om', 'all'] }).notNull(),
  label: text('label').notNull(),
  groupName: text('group_name'),
  isDivisionSubtotal: boolean('is_division_subtotal').notNull().default(false),
  adopted2026: fte('adopted_2026'),
  requested2027: fte('requested_2027'),
  proposed2027: fte('proposed_2027'),
  changeVsAdopted: fte('change_vs_adopted'),
  changeVsRequested: fte('change_vs_requested'),
  cite: cite(),
})

export const calendarEvents = pgTable('calendar_events', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  date: date('date').notNull(),
  title: text('title').notNull(),
  kind: text('kind', { enum: ['hearing', 'amendment_day', 'adoption', 'deadline'] }).notNull(),
  sourceUrl: text('source_url').notNull(),
})

// Embeddings keyed by a fingerprint of (model, input_type, text), not by row: reloads rewrite
// rows (D14), and the cache refills their vectors without calling the API again.
export const embeddingCache = pgTable('embedding_cache', {
  hash: text('hash').primaryKey(), // sha256(model | input_type | text)
  model: text('model').notNull(),
  inputType: text('input_type').notNull(),
  embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// v2 (P5) — table exists so the Adopted load needs no migration.
export const amendments = pgTable('amendments', {
  id: serial('id').primaryKey(),
  budgetVersionId: versionId(),
  number: text('number').notNull(),
  sponsor: text('sponsor'),
  deptId: deptId(),
  description: text('description').notNull(),
  amountChange: money('amount_change'),
  status: text('status'),
  legistarUrl: text('legistar_url'),
})

// Property data is keyed by assessment year, not budget version.
// NO owner name / mailing fields — addresses are never stored with people (docs/07 §8).
export const mpropParcels = pgTable('mprop_parcels', {
  taxkey: text('taxkey').primaryKey(),
  yrAssmt: smallint('yr_assmt').notNull(),
  houseNrLo: integer('house_nr_lo'),
  houseNrHi: integer('house_nr_hi'),
  houseNrSfx: text('house_nr_sfx'),
  sdir: text('sdir'),
  street: text('street'),
  sttype: text('sttype'),
  unit: text('unit'),
  cATotal: money('c_a_total'),
  cAExmTotal: money('c_a_exm_total'),
  pATotal: money('p_a_total'),
  pAExmTotal: money('p_a_exm_total'),
  cAClass: text('c_a_class'),
  landUse: text('land_use'),
  landUseGp: text('land_use_gp'),
  bldgType: text('bldg_type'),
  nrUnits: integer('nr_units'),
  ownOcpd: text('own_ocpd'),
  taxRateCd: text('tax_rate_cd'),
  dpwSanitation: text('dpw_sanitation'),
  geoAlder: text('geo_alder'),
  lotArea: integer('lot_area'),
  cornerLot: text('corner_lot'),
  loadedAt: timestamp('loaded_at', { withTimezone: true }).notNull().defaultNow(),
})

// City Receipt (docs/07, D15): one row per MPROP parcel, from a dated snapshot, not a budget version.
// Owner names and mailing addresses are never loaded (pipeline/extract/mprop.py doesn't read them).
// Taxable assessment = cATotal (exempt parcels carry 0 there; see docs/open-questions.md).
export const parcels = pgTable(
  'parcels',
  {
    taxkey: text('taxkey').primaryKey(),
    snapshotDate: date('snapshot_date').notNull(),
    yrAssmt: text('yr_assmt'),
    taxRateCd: text('tax_rate_cd'),
    houseNrLo: integer('house_nr_lo'),
    houseNrHi: integer('house_nr_hi'),
    houseNrSfx: text('house_nr_sfx'),
    sdir: text('sdir'),
    street: text('street'),
    sttype: text('sttype'),
    cAClass: text('c_a_class'),
    cATotal: bigint('c_a_total', { mode: 'number' }),
    cAExmType: text('c_a_exm_type'),
    cAExmTotal: bigint('c_a_exm_total', { mode: 'number' }),
    pATotal: bigint('p_a_total', { mode: 'number' }),
    pAExmTotal: bigint('p_a_exm_total', { mode: 'number' }),
    nrUnits: integer('nr_units'),
    ownOcpd: text('own_ocpd'),
    landUse: text('land_use'),
    landUseGp: text('land_use_gp'),
    bldgType: text('bldg_type'),
    dpwSanitation: text('dpw_sanitation'),
    geoAlder: text('geo_alder'),
    lotArea: numeric('lot_area', { precision: 14, scale: 2 }),
    cornerLot: text('corner_lot'),
    // '2401 W WISCONSIN AV': what address search matches against (typo-tolerant trigram index)
    address: text('address').generatedAlwaysAs(
      sql`trim(coalesce(house_nr_lo::text, '') || coalesce(house_nr_sfx, '') || coalesce(' ' || sdir, '') || coalesce(' ' || street, '') || coalesce(' ' || sttype, ''))`,
    ),
  },
  (t) => [
    index('parcels_street_house_idx').on(t.street, t.houseNrLo),
    index('parcels_address_trgm_idx').using('gin', sql`${t.address} gin_trgm_ops`),
  ],
)

// Chat questions per Central-time day, for the daily spending cap (D20). The only table the app's
// read-only role may write.
export const chatUsage = pgTable('chat_usage', {
  day: date('day').primaryKey(),
  questions: integer('questions').notNull().default(0),
})
