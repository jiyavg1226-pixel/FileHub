# FileHub — Public File Sharing + Offline Viewer

## Run locally
1. Install Node.js (LTS) on your computer.
2. Extract this folder.
3. Open a terminal inside the `filehub` folder.
4. Run `npm install`
5. Run `npm start`
6. Open `http://localhost:3000`

## How it works
- Anyone who can access the website can upload and view public files.
- Files up to 50 MB are stored on the server in `data/uploads`.
- On a first online visit, the browser attempts to save every listed file in IndexedDB.
- The app shell is cached by a service worker.
- PDF, images, text, audio and video can be previewed in supported browsers.
- Other formats (such as DOCX, XLSX and PPTX) are saved offline but may not preview directly in every browser.

## Important limitations before publishing
- This is a learning/demo starter, not a hardened public production service.
- Anyone can upload public content. Add moderation, reporting, rate limits, malware scanning, authentication for moderators, and clear terms before opening it to the public.
- A browser may limit offline storage or clear it. Large libraries may not fully save. The page reports how many files were saved.
- Offline files are stored separately in each browser/device. A friend must visit online at least once on that device to receive the files.
- Local disk storage is not suitable for many users or multi-server hosting. For deployment, use persistent object storage and a database.
- Deploy behind HTTPS; service workers and PWA offline features require HTTPS (localhost is allowed for development).
- Do not upload private or sensitive documents: this demo makes uploaded files public.
