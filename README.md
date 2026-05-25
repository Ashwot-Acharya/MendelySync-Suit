# Mendeley Local Sync Suite

This suite is a lightweight and modern utility to import your Mendeley library, store it locally in a SQLite database, and synchronize it to a React Native mobile application for offline access.

The suite consists of three modules:
1. **Firefox Extension (mendeley-browser-extension)**: A Manifest V3 extension that captures your active API credentials from the Mendeley Web Library and imports your catalog.
2. **Local Host Server (mendeley-local-server)**: A Node.js and Express backend that hosts a SQLite database (references.db) and serves a dark-mode web dashboard to search and view your documents.
3. **React Native Mobile App (mendeley-mobile-app)**: An Expo React Native application featuring local offline storage (AsyncStorage) and real-time synchronization from your computer over Wi-Fi.

---

## Project Architecture & Structure

```
mendeley-sync-suite/
├── mendeley-browser-extension/      # Firefox WebExtension (Manifest V3)
│   ├── manifest.json                # Match rules, host permissions, and iframe injections
│   ├── content-main.js              # Runs in MAIN world; intercepts api.mendeley.com requests
│   ├── content-isolated.js          # Runs in ISOLATED world; executes recursive paginated syncing
│   ├── popup.html                   # Extension interface with manual override panels
│   └── popup.js                     # Extension popup logic and status checks
│
├── mendeley-local-server/           # Node.js + Express Server & SQLite Database
│   ├── server.js                    # Binds local APIs, detects active IPs, serves web dashboard
│   ├── database.js                  # Initializes SQLite schema and manages transactions
│   ├── package.json                 # Pre-configured package specifications
│   └── public/                      # Glassmorphic Web Dashboard
│       ├── index.html               # Structured dashboard (search, metrics, modal drawers)
│       ├── app.css                  # Dark-mode layouts, neon glows, and custom scrollbars
│       └── app.js                   # Client-side fast search indexing and panel filtering
│
└── mendeley-mobile-app/             # Expo React Native App (iOS & Android)
    ├── App.js                       # Mobile view, Wi-Fi pairing manager, and offline list cache
    ├── app.json                     # Mobile metadata and package naming
    └── package.json                 # Core React Native and Expo specifications
```

---

## Installation and Quick Start

Follow these steps to run the complete suite on your local machine:

### 1. Start the Local Host Server
The Express server manages the local SQLite database and acts as the syncing bridge.

1. Open your terminal and navigate to the server folder:
   ```bash
   cd mendeley-local-server
   ```
2. Launch the server:
   ```bash
   npm start
   ```
3. The server will boot up and print a banner on your terminal displaying your computer's local Wi-Fi IP address (e.g. http://192.168.7.68:3000). Make note of this address.
4. Open http://localhost:3000 in your browser to view your library dashboard.

---

### 2. Install the Firefox Extension
The extension captures your active login session and imports your papers.

1. Open Firefox.
2. Type "about:debugging" in the URL bar and press Enter.
3. Click "This Firefox" on the left menu.
4. Click the "Load Temporary Add-on..." button.
5. Select the "manifest.json" file inside the "mendeley-browser-extension" folder.
6. Open your Mendeley Reference Manager Library (make sure you are logged in).
7. Open the extension popup in your toolbar. The status indicator will automatically turn green and show "Connected" (having intercepted the API token from the page's frame requests).
8. Input your local server URL (http://localhost:3000) and click "Sync References Now".
9. Refresh your dashboard at http://localhost:3000 to browse your imported scientific catalog.

Note: If browser cookie security prevents automatic token extraction, click "Manual Authorization Override" in the popup. Follow the instructions to copy the "Authorization" header from your browser's Network tab, paste it, click Save, and sync.

---

### 3. Run the React Native Mobile App
Browse your papers offline on the go.

1. Open a terminal and navigate to the mobile folder:
   ```bash
   cd mendeley-mobile-app
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. A QR code will display in your terminal.
   - For iOS: Open the native iOS Camera app and scan the QR code to open the app inside the free Expo Go application.
   - For Android: Open the Expo Go app and select "Scan QR Code".
5. Connect your phone to the same local Wi-Fi network as your computer.
6. Enter your server's Wi-Fi IP address (printed on the server console, e.g. http://192.168.7.68:3000) inside the mobile sync card and tap Sync.
7. Your library is now cached offline on your phone. Turn off Wi-Fi or go offline and test the search and abstract drawers.

---

## Design and Interface Features

* **Glassmorphic Layout**: Contrast containers backed by blur filters and subtle borders.
* **Ambient Glows**: Blurred radial gradients providing a dark-mode interface experience.
* **Transitions**: Custom scrollbars, sliding drawer overlays, loading indicators, and hover states on all cards.
* **Text Search Indexing**: Client-side text filtering across titles, journals, publication years, and author names.

---

## License

This project is licensed under the MIT License.
