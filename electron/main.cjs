/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const crypto = require("node:crypto");
const next = require("next");

const { app, BrowserWindow, dialog } = require("electron");

const HOST = "127.0.0.1";
const SERVER_START_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 500;

let mainWindow = null;
let nextApp = null;
let nextHttpServer = null;
let serverPort = null;
let internalToken = null;
let allowAppQuit = false;
let isHandlingClose = false;

function getAppRoot() {
  return app.getAppPath();
}

function getServerUrl() {
  return `http://${HOST}:${serverPort}`;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve a free port.")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForServerReady() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${getServerUrl()}/api/auth/status`, {
        cache: "no-store",
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out while starting the MongoSync server.");
}

async function startNextServer() {
  if (nextHttpServer) {
    return;
  }

  process.env.HOSTNAME = HOST;
  process.env.MONGOSYNC_INTERNAL_TOKEN = internalToken;
  process.env.PORT = String(serverPort);

  nextApp = next({
    dev: !app.isPackaged,
    dir: getAppRoot(),
    hostname: HOST,
    port: serverPort,
  });

  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  nextHttpServer = http.createServer((request, response) => {
    void handle(request, response);
  });

  await new Promise((resolve, reject) => {
    nextHttpServer.once("error", reject);
    nextHttpServer.listen(serverPort, HOST, () => resolve());
  });
}

function stopNextServer() {
  return new Promise((resolve) => {
    if (!nextHttpServer) {
      nextApp = null;
      resolve();
      return;
    }

    const serverToStop = nextHttpServer;
    nextHttpServer = null;
    nextApp = null;
    serverToStop.close(() => resolve());
  });
}

async function getActiveJobsSummary() {
  const response = await fetch(`${getServerUrl()}/api/runtime/active-jobs`, {
    cache: "no-store",
    headers: {
      "x-mongosync-internal-token": internalToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Active job check failed with status ${response.status}.`);
  }

  return response.json();
}

async function confirmQuitIfNeeded() {
  try {
    const summary = await getActiveJobsSummary();

    if (!summary.hasActiveJobs) {
      return true;
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Keep app open", "Quit app"],
      defaultId: 0,
      cancelId: 0,
      title: "Copy job is still running",
      message:
        summary.activeJobCount === 1
          ? "A copy job is still running."
          : `${summary.activeJobCount} copy jobs are still running.`,
      detail:
        "If you quit now, the running job will stop. Saved job info and logs will remain on disk, and the next app launch will show that job as interrupted.",
      noLink: true,
    });

    return response === 1;
  } catch {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Keep app open", "Quit app"],
      defaultId: 0,
      cancelId: 0,
      title: "Unable to verify running jobs",
      message: "MongoSync could not verify whether a copy job is running.",
      detail:
        "Quitting now may stop an active copy. Saved job info and logs will remain on disk, and the next app launch will show interrupted work if the process was terminated mid-copy.",
      noLink: true,
    });

    return response === 1;
  }
}

async function handleWindowClose(event) {
  if (allowAppQuit || isHandlingClose) {
    return;
  }

  event.preventDefault();
  isHandlingClose = true;

  try {
    const shouldQuit = await confirmQuitIfNeeded();

    if (!shouldQuit) {
      return;
    }

    allowAppQuit = true;
    await stopNextServer();
    mainWindow.close();
  } finally {
    isHandlingClose = false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 800,
    autoHideMenuBar: true,
    title: "MongoSync",
    icon: path.join(getAppRoot(), "public", "assets", "full logo.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
    },
  });

  mainWindow.on("close", (event) => {
    void handleWindowClose(event);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(getServerUrl());
}

async function bootstrap() {
  serverPort = await getFreePort();
  internalToken = crypto.randomUUID();

  await startNextServer();
  await waitForServerReady();
  createMainWindow();
}

app.whenReady().then(() => {
  void bootstrap().catch(async (error) => {
    await dialog.showMessageBox({
      type: "error",
      title: "MongoSync",
      message: "Failed to start MongoSync.",
      detail: error instanceof Error ? error.message : "Unknown startup error.",
    });

    allowAppQuit = true;
    await stopNextServer();
    app.quit();
  });
});

app.on("before-quit", (event) => {
  if (allowAppQuit || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  event.preventDefault();
  mainWindow.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  allowAppQuit = true;
  void stopNextServer();
});

app.on("activate", () => {
  if (!mainWindow && serverPort) {
    createMainWindow();
  }
});
