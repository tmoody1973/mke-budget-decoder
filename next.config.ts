import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js 6's standard build calls Map.getOrInsertComputed and other brand-new built-ins that
  // iPhone Safari lacks, so the source drawer never loaded there. The legacy build polyfills them.
  turbopack: { resolveAlias: { "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs" } },
};

export default nextConfig;
