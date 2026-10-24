// Bridge exposed by electron/preload.cjs. Absent when running in a normal browser.
type MongosyncDesktopBridge = {
  isElectron: true;
  windowControls: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  };
};

interface Window {
  mongosyncDesktop?: MongosyncDesktopBridge;
}
