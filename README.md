# 8 Crore Naam Jap Mission — React + Vite

A responsive React PWA based on the supplied `index.html` layout/content. It tracks the 8 Crore mission, daily goal, progress phases, milestones, streaks, history, backup/import and CSV export. Local data is saved in the browser.

## Run locally

```bash
npm install
npm run dev
```

## Google Sheets setup

1. Create a Google Spreadsheet.
2. Open **Extensions → Apps Script**.
3. Copy `google-apps-script/Code.gs` into `Code.gs` and save.
4. In Apps Script choose **Deploy → New deployment → Web app**.
5. Set **Execute as: Me**. Set access according to your preference; for a personal project, "Anyone" makes the endpoint accessible to the app, so do not use it for sensitive data.
6. Deploy and copy the Web App URL ending in `/exec`.
7. Copy `.env.example` to `.env` and set `VITE_GOOGLE_SCRIPT_URL=YOUR_WEB_APP_URL`.
8. Restart the Vite dev server or rebuild/redeploy after changing `.env`.

The app sends pending entries as JSON using a `no-cors` request. Browsers do not expose the Apps Script response in this mode, so the UI deliberately says **“Request sent — verify Sheet”** rather than claiming confirmed sync. Entries remain in local storage and can be re-sent safely: the Apps Script code deduplicates by entry ID. Once you verify that rows arrived, you can clear the local pending queue by using the developer console:
`const s=JSON.parse(localStorage.getItem("naam-jaap-mission-v1")); s.pending=[]; localStorage.setItem("naam-jaap-mission-v1",JSON.stringify(s));`
A future improvement would be a small authenticated backend/proxy for confirmed two-way sync.

## Important notes

- Data is stored per browser/device. LocalStorage does not automatically sync between iPhone and Windows.
- Google Sheets is the shared record store after entries are successfully delivered.
- Export JSON regularly as a backup.
- The service worker caches the app shell; first load and some assets still require internet.
- The uploaded `index.html` provided the mission structure and labels. The uploaded `sw.js` was actually a GitHub webpage HTML snapshot, not JavaScript service-worker source, so it was replaced with a valid React PWA service worker.
