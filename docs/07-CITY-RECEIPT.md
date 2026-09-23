# 07 — My City Receipt: owners, renters, landlords

One feature, three views, same honest math. Enter an address → an estimate of what the city charges for that home in 2027 vs 2026, where the property tax portion goes, and what the city spends per resident on services.

## 1. Why renters get a receipt too

Milwaukee is a majority-renter city (confirm the current share with ACS and with MPROP's `OWN_OCPD` flag before quoting it). A tax-receipt feature that only works for owners leaves most residents out. But renters don't get a tax bill, so pretending to give them one would be wrong. The renter receipt instead answers three factual questions:

1. **What does the city charge the home I live in?** The building's estimated city levy and service charges, divided per unit. Paid by the landlord.
2. **What do I pay the city directly?** The 2% city sales tax on purchases in Milwaukee (optional spending input), and any fees the user pays themselves.
3. **What does the city spend on services for me?** Per-resident spending by service. Identical for owners and renters.

What it must **not** do: claim how much of the rent is property tax. The budget doesn't measure pass-through, and how much landlords pass on varies. The receipt states the per-unit figure and says plainly that it's paid by the owner and that pass-through to rent isn't known.

## 2. Data

### MPROP (Master Property File)
Source: City of Milwaukee Open Data Portal, `mprop.csv` (~160,000 records, 90+ fields, updated daily) plus the field documentation PDF. Budget Compass already loads this with normalized address search; port it.

Fields used (confirm names against the current data dictionary):

| Field | Use |
|---|---|
| `TAXKEY` | Primary key; join to parcel polygons |
| `HOUSE_NR_LO`, `HOUSE_NR_HI`, `HOUSE_NR_SFX`, `SDIR`, `STREET`, `STTYPE`, `UNIT` | Address match (range-aware: a building can span `LO`–`HI`) |
| `YR_ASSMT` | Which assessment year `C_A_*` represents |
| `C_A_TOTAL`, `C_A_LAND`, `C_A_IMPRV` | Current assessed value (2026 assessment) |
| `C_A_EXM_TYPE`, `C_A_EXM_TOTAL` | Exempt amounts; taxable value = total − exempt |
| `P_A_TOTAL`, `P_A_EXM_TOTAL` | **Prior-year assessment** (2025) → year-over-year comparison without a second file |
| `C_A_CLASS`, `LAND_USE`, `LAND_USE_GP`, `BLDG_TYPE` | Residential vs commercial vs mixed; condo detection |
| `NR_UNITS` | Per-unit split for renters and landlords |
| `OWN_OCPD` | Owner-occupied flag (O/null) → default view (owner vs renter) |
| `TAX_RATE_CD` | Confirm all parcels use the same city rate; flag unusual codes |
| `DPW_SANITATION` | Helps decide whether the property gets city garbage service |
| `GEO_ALDER` | Alderperson for the "take part" panel |
| `LOT_AREA`, `CORNER_LOT` | Inputs for the frontage estimate |
| `OWNER_NAME_1`, `OWNER_MAIL_ADDR` | **Never loaded into the app database.** Drop at ingest |

MPROP's own documentation notes that properties not assessed by the city (manufacturing and tax-exempt, including city-owned) have limited data. For those, the receipt says so instead of estimating.

### Street frontage
Snow & ice and street lighting are charged per foot of frontage, and MPROP has no frontage field. Order of preference: (1) compute frontage from parcel polygon geometry where the parcel edge meets the street right-of-way (P6-level work); (2) let the user enter it; (3) default to 40 ft, the "typical property" the budget itself uses (p.141), clearly labeled. Corner lots: note that frontage rules may differ; don't guess.

### Rates and charges (from the budget; all cited)

| Item | 2026 | 2027 proposed | Source |
|---|---|---|---|
| City tax rate per $1,000 assessed | $7.61 | $7.29 | Summary p.7 |
| …of which General City Purposes | $3.33 | $3.05 | p.7 |
| …Debt | $2.41 | $2.31 | p.7 |
| …Employee retirement (pensions) | $1.74 | $1.80 | p.7 |
| …Contingent fund | $0.11 | $0.11 | p.7 |
| …Capital improvements | $0.02 | $0.02 | p.7 |
| Solid waste, per residential unit per year | $271.80 | $280.00 | p.159 |
| Extra garbage cart, each per year | $81.24 | $83.68 | p.159 |
| Snow & ice, per frontage foot | $1.19 | $1.23 | p.159 |
| Street lighting, per frontage foot | $1.12 | $1.16 | p.159 |
| Sewer + stormwater, average household | $241.88 (derived) | $247.02 | p.203 |

Rate components are printed rounded to the cent. Compute the city levy from the total rate; show components as the split, and make the rounding remainder explicit if they don't sum exactly.

## 3. The math

```
taxable_2026_assessment = C_A_TOTAL                          # funds the 2027 budget
taxable_2025_assessment = P_A_TOTAL                          # funded the 2026 budget
# C_A_TOTAL is already taxable: exempt parcels carry 0 there and their value in C_A_EXM_TOTAL;
# no parcel has both (checked on the 2026-09-23 snapshot, tests/test_parcels.py).

city_levy_est_2027 = taxable_2026_assessment × 7.29 / 1000
city_levy_est_2026 = taxable_2025_assessment × 7.61 / 1000
split_2027[section] = taxable_2026_assessment × rate_component[section] / 1000

service_charges_2027 = solid_waste (if city-served) × residential units
                     + extra_carts × 83.68
                     + frontage_ft × (1.23 + 1.16)
                     + 247.02 × residential units          # average; actual depends on water use

per_unit (renter/landlord views) = (city_levy_est + service_charges) / NR_UNITS
```

Before launch, confirm with the City Treasurer which tax bill funds which budget year (the rate here is the 2027 budget's rate, applied to the 2026 assessment, i.e. the bill issued in December 2026), and which bill each service charge appears on (property tax bill vs. the separate municipal services bill). Word the UI accordingly.

**"Where your city property tax goes" by department.** Property tax isn't earmarked by department; only the section split above is exact. For a department view, allocate the General City Purposes portion in proportion to each department's share of GCP spending net of its own revenues. Label it "illustrative allocation," show the method in one sentence, and link to the methodology page.

## 4. Worked examples (hypothetical properties, for tests and UI copy)

**Owner — single-family home, owner-occupied.** 2026 assessment $200,000; 2025 assessment $188,000; 40 ft frontage; one cart.

| Line | 2026 | 2027 est. | Change |
|---|---|---|---|
| City property tax | $1,430.68 | $1,458.00 | +$27.32 (+1.9%) |
| …city operations (GCP) | | $610.00 | |
| …debt | | $462.00 | |
| …pensions | | $360.00 | |
| …contingent fund | | $22.00 | |
| …capital | | $4.00 | |
| Solid waste | $271.80 | $280.00 | +$8.20 |
| Snow & ice (40 ft) | $47.60 | $49.20 | +$1.60 |
| Street lighting (40 ft) | $44.80 | $46.40 | +$1.60 |
| Sewer + stormwater (avg household) | $241.88 | $247.02 | +$5.14 |
| **City total** | **$2,036.76** | **$2,080.62** | **+$43.86** |

Note: in this example, service charges rise $16.54 and the property tax rises $27.32 even though the tax rate fell, because the assessment rose 6.4%. A home whose assessment was flat would see its city property tax fall.

**Renter — unit in a 4-unit building.** Building 2026 assessment $320,000; 2025 $305,000; not owner-occupied.

| Line (your unit's share, paid by the owner) | 2026 | 2027 est. |
|---|---|---|
| City property tax ÷ 4 | $580.26 | $583.20 |
| Solid waste (per unit) | $271.80 | $280.00 |
| Frontage charges ÷ 4 | $23.10 | $23.90 |
| Sewer + stormwater (avg household) | $241.88 | $247.02 |
| **Per unit per year** | **$1,117.04** | **$1,134.12** |
| **Per unit per month** | **$93.09** | **$94.51** |

UI copy: "The city charges about $94.51 a month for your unit's share of this building, paid by the owner. The budget doesn't show how much of that reaches your rent."

**Landlord view.** Same as the renter math, plus the building totals and per-unit table. Triggered when `OWN_OCPD` is null and `NR_UNITS > 1`, or chosen by the user.

## 5. The services side (same for everyone)

"What the city spends on services per resident": GCP spending by department (proposed 2027) ÷ population (latest Census estimate, stored in config with its source), shown per year and per day. This half of the receipt is identical for owners and renters and shows that everyone funds the city through a mix of property tax (directly or through the owner), the 2% city sales tax, state shared revenue, and fees. Include the budget's own revenue mix (Source of Funds, p.156–159) so residents see that property tax is 17.0% of GCP revenue (p.2).

Optional renter input: "About how much do you spend on taxable purchases in Milwaukee each month?" → × 2% city sales tax. User-provided number, clearly labeled.

## 6. Edge cases

| Case | Handling |
|---|---|
| Address matches several taxkeys (condos, `LO`–`HI` ranges) | Show a picker (unit list). Condo units have their own taxkey and assessment: use the unit, not the building |
| Mixed-use building (retail below apartments) | Show the building total; for per-unit views, warn that commercial space is included in the value and the split is approximate |
| Large complexes (many taxkeys, private garbage service) | Use `DPW_SANITATION`/land use to decide if the city solid waste fee applies; if unsure, show it as "may not apply" |
| Exempt property | "This property is exempt from property tax" (+ exemption type if present) |
| Manufacturing / state-assessed | "Assessed by the state; the city file doesn't have enough to estimate" |
| New construction / big assessment change | Show both years; note that `P_A_TOTAL` may be partial for new construction |
| Tax-delinquent flag (`TAX_DELQ`) | Never display. Irrelevant to the estimate and sensitive |
| Assessment under appeal | Not in MPROP; the note "assessments can change through Board of Review" covers it |

## 7. What the receipt always says

- "Estimate. Based on the Mayor's **proposed** budget; the Common Council may change it before adopting by November 14."
- "City portion only. Your actual property tax bill also includes Milwaukee Public Schools, Milwaukee County, MMSD, MATC, and state credits." (v2 option: add other jurisdictions using the Treasurer's published rates, labeled as last year's actual rates.)
- "Uses the 2026 assessment on file; the final rate is set after adoption."
- Defaults are labeled (40 ft frontage, one cart, average household sewer/stormwater).
- Per-department amounts are illustrative allocations.

## 8. Privacy

- Owner names and mailing addresses are dropped at ingest and never shown.
- Addresses and taxkeys typed by users are not logged or stored; the receipt URL encodes only a hashed taxkey token that expires, or nothing (user re-enters).
- No browsing, search-by-owner, or "look up your neighbors" features. Rate-limit lookups to prevent scraping, even though MPROP is public record.
- Renters' addresses reveal where they live; treat them with the same no-retention rule.

## 9. Tool and component changes

`get_household_charges` becomes:

```ts
get_household_charges({
  address?: string; taxkey?: string; unit?: string;          // or
  assessedValue?: number; priorAssessedValue?: number;       // manual mode
  view?: 'owner' | 'renter' | 'landlord';                    // default from OWN_OCPD / NR_UNITS
  frontageFt?: number; extraCarts?: number; monthlyTaxableSpend?: number;
})
```

Returns the receipt lines for 2026 and 2027 with a citation for every rate, the MPROP fields used (with `YR_ASSMT`), defaults applied, and caveats. Components: `HouseholdCityBill` (owner), `RentersReceipt` (building share + direct + services), `LandlordReceipt`, `ServicesPerResident`, `AddressPicker` (HITL for multi-taxkey matches).

## 10. Tests

- The two worked examples in §4 as unit tests (exact to the cent).
- Condo, mixed-use, exempt, 4+ unit, and range-address fixtures from real MPROP rows (owner fields removed).
- Snapshot test that no owner name or mailing address can reach any API response.
