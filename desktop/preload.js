const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods to renderer
contextBridge.exposeInMainWorld("electron", {
	minimize: () => ipcRenderer.send("window-minimize"),
	maximize: () => ipcRenderer.send("window-maximize"),
	close: () => ipcRenderer.send("window-close"),
	setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.send("window-always-on-top", alwaysOnTop),
});
