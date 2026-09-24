// Light and dark themes (DESIGN.md tokens in app/globals.css). The choice is "system", "light" or
// "dark", kept in localStorage; the head script below applies it before first paint so nothing flashes.
export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_KEY = 'theme'
// The browser toolbar color for each theme, as hex (some browsers only read sRGB hex there): the paper token.
export const THEME_COLORS = { light: '#ffffff', dark: '#101621' } as const

/** The theme a choice resolves to, given whether the system prefers dark. */
export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' =>
  choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

/** Sets .dark or .light on <html> and the browser's toolbar color to match. */
export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice, window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[theme]))
}

/** Inline in <head>: the same resolution as resolveTheme, before React loads. Storage can throw
 *  (private windows, blocked cookies); the system setting then applies through CSS. */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');var d=c==='dark'||(c!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement.classList;r.toggle('dark',d);r.toggle('light',!d)}catch(e){}})()`
