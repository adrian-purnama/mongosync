<table>
  <tr>
    <td><img src="public/assets/logo%20only.png" alt="MongoSync logo" width="90" /></td>
    <td><img src="public/assets/name%20only.png" alt="MongoSync name" width="180" /></td>
  </tr>
</table>

# MongoSync

MongoSync is a desktop application that helps developer copy db to db and export entire db, this project is supposed to help developer when developing or debugging their application by quickly copying entire db or exporting entire DB. This application is AES encrypted by your own initial password

[Release v0.1.0](https://github.com/adrian-purnama/mongosync/releases/tag/v0.1.0)

## Overview

MongoSync is designed for development and operational workflows where you want a friendlier interface for moving MongoDB data without pushing credentials or copy logic into a hosted service.

Key characteristics:

- All data lives locally in APPDATA
- Windows desktop packaged with Electron
- Encrypted saved MongoDB connection strings
- Persistent job history stored on disk

## How It Works

MongoSync uses a split architecture, if you think of it this app is like minecraft, there is a client and a server into one application:

- The frontend provides the interface for authentication, workspace navigation, connection management, and copy flows.
- The local backend process handles database access, encryption, job execution, and runtime state.

This means MongoDB credentials and copy operations stay on the same machine as the user running the app.

## Features

- Save organizations and MongoDB connections locally
- Encrypt persisted connection strings
- Browse copy targets through a desktop UI
- Run local copy jobs without exposing credentials to a remote service
- Persist job metadata and logs between sessions
- Warn before quitting while active copy jobs are running

## Tech Stack

- `Next.js 16`
- `React 19`
- `Electron 41`
- `electron-builder`
- `MongoDB Node.js Driver`
- `TypeScript`

## Getting Started

### Prerequisites

- `Node.js`
- `npm`
- Windows for desktop packaging and installer generation

Install dependencies:

```bash
npm install
```

## Development

Run the web app in browser development mode:

```bash
npm run dev
```

Run the Electron desktop shell:

```bash
npm run electron:dev
```

The Electron process starts the local Next.js server automatically and opens MongoSync in a desktop window.

## Production Build

Build the application:

```bash
npm run build
```

Run the built app through Electron:

```bash
npm run electron:start
```

Create the Windows installer:

```bash
npm run dist:win
```

Build outputs are written to `dist-electron/`.


## Local Data Storage

On Windows, MongoSync stores its local application data under:

```text
%APPDATA%\MongoSync
```

This directory contains items such as:

- app configuration
- session key material
- encrypted job-related data
- persisted copy job metadata and logs

## Authentication And Security

- A master password is used to unlock the app
- Saved MongoDB connection strings are encrypted before being stored
- Application state is kept locally rather than delegated to a remote backend

If a user loses their master password and no recovery path exists, previously encrypted saved secrets may become inaccessible and local app data may need to be reset.

Although encrypted the encrypted file is still vurnerable to brute force attack


## Scripts

- `npm run dev` - Start the Next.js development server 
- `npm run build` - Create the production Next.js build
- `npm run start` - Start the production Next.js server
- `npm run electron:dev` - Launch Electron in development
- `npm run electron:start` - Launch Electron against the built app
- `npm run dist:win` - Build the Windows NSIS installer
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest
