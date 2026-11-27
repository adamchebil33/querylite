/**
 * App-wide branding. Rename the product here; the page title and headers
 * read from this file.
 * (The Cloudflare Worker name lives separately in wrangler.jsonc.)
 */
export const APP_NAME = 'Querylite';
export const APP_TAGLINE =
  'Drop in a CSV and query millions of rows instantly, right in your browser. Nothing is uploaded.';

/** The live site. Link previews (LinkedIn, Slack...) need absolute URLs, so index.html uses it. */
export const SITE_URL = 'https://querylite.adamchebil.workers.dev';

/** Where the source code lives; shown as a link in the landing page footer. */
export const REPO_URL = 'https://github.com/adamchebil33/querylite';
