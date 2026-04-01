# MongoSync Local

MongoSync Local is a local-first MongoDB copy utility built with Next.js and wrapped for Windows desktop with Electron.

## Development

Run the browser development server:

```bash
npm run dev
```

Run the Electron desktop shell in development:

```bash
npm run electron:dev
```

The Electron shell starts the local Next.js server automatically and opens the app in a desktop window.

## Production

Build the Next.js app:

```bash
npm run build
```

Run the built app through Electron:

```bash
npm run electron:start
```

Create the Windows installer: v

```bash
npm run dist:win
```

The packaged installer/build artifacts are written to `dist-electron/`.

## Local Data Storage

On Windows, MongoSync Local stores local data under:

```text
%APPDATA%\\MongoSyncLocal
```

That folder contains app configuration, session key material, and persisted copy job data.

## Active Copy Jobs

If a copy job is active and the user closes the desktop window, the app shows a confirmation dialog before quitting.

- If the user keeps the app open, the copy keeps running.
- If the user quits, the copy stops.
- Persisted job information remains on disk and will be shown as interrupted on the next launch.
