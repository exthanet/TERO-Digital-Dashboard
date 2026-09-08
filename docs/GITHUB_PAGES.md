# GitHub Pages deployment

Run `npm ci` and `npm run build:pages` to build the existing dashboard as a static app in `dist/github-pages`.
The separate Vite configuration preserves the existing Sites/Worker deployment.
Asset URLs use `/TERO-Digital-Dashboard/`, including both report JSON files.

Charts, filters, affiliate reports, local Excel/CSV import, public Google Sheets import, and CSV export run in the browser.
GitHub Pages cannot run the Worker, API Sync status endpoint, or dispatch-owned ChatGPT authentication.
The API Sync button is omitted from the static build.

## Publish

Publishing makes the bundled `public/master-data.json` and `public/affiliate-data.json` accessible to visitors.
A private repository does not make a standard GitHub Pages site private. Obtain approval for public access before publishing.
Private-repository Pages requires an eligible GitHub plan; do not change repository visibility to bypass that requirement.

In repository Settings > Pages, select GitHub Actions as the source.
Then manually run **Publish dashboard to GitHub Pages** in Actions.
The workflow builds and deploys the static artifact. It does not run automatically on pushes.
The expected address is `https://exthanet.github.io/TERO-Digital-Dashboard/` once deployment succeeds.

No provider credentials are required or included in this build. Keep secrets in the existing server environment.
