// Worked-example rates (docs/07 §4). Same values the database holds; lib/db/receipt.test.ts checks that.
import type { ReceiptRates } from './receipt'

const cite = { doc: 'summary', pdf_page: 17, printed_page: '7' } as const
const fcite = { doc: 'summary', pdf_page: 169, printed_page: '159' } as const
export const RATES: ReceiptRates = {
  total: { r2026: '7.61', r2027: '7.29', cite },
  components: [
    { section: 'A', label: 'City operations (General City Purposes)', r2026: '3.33', r2027: '3.05', cite },
    { section: 'D', label: 'Debt', r2026: '2.41', r2027: '2.31', cite },
    { section: 'B', label: 'Pensions (Employee Retirement)', r2026: '1.74', r2027: '1.80', cite },
    { section: 'F', label: 'Contingent fund', r2026: '0.11', r2027: '0.11', cite },
    { section: 'C', label: 'Capital improvements', r2026: '0.02', r2027: '0.02', cite },
  ],
  fees: {
    solid_waste: { v2026: '271.80', v2027: '280.00', cite: fcite },
    extra_cart: { v2026: '81.24', v2027: '83.68', cite: fcite },
    snow_ice: { v2026: '1.19', v2027: '1.23', cite: fcite },
    street_lighting: { v2026: '1.12', v2027: '1.16', cite: fcite },
    sewer_stormwater_avg: { v2026: '241.88', v2027: '247.02', cite: { doc: 'summary', pdf_page: 213, printed_page: '203' } },
  },
}
