// Build-time client: runs in Node while Astro generates the static pages, so here (and
// ONLY here) `process.env` exists. Importing this from a React island breaks hydration in
// the browser with `ReferenceError: process is not defined`.
import { readJson } from './api';

export const BUILD_API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8080';

/** Used from `.astro` frontmatter while the site is being generated. */
export async function fetchAtBuild<T>(path: string): Promise<T> {
  return readJson<T>(await fetch(`${BUILD_API_BASE}${path}`));
}
