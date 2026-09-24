// Gives the Archify diagrams in public/diagrams the site's colors and type (docs/diagrams/site-theme.css).
// Run after `archify deliver`: node scripts/theme-diagrams.mjs. Safe to rerun.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const css = readFileSync('docs/diagrams/site-theme.css', 'utf8')
const tag = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;800&display=swap"><style id="site-theme">${css}</style>`
for (const f of readdirSync('public/diagrams').filter((f) => /^[a-z]+\.html$/.test(f))) {
  const path = `public/diagrams/${f}`
  const html = readFileSync(path, 'utf8').replace(/<link[^>]*Libre\+Franklin[^>]*><style id="site-theme">[\s\S]*?<\/style>/, '')
  writeFileSync(path, html.replace('</head>', `${tag}</head>`))
  console.log('themed', path)
}
