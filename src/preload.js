const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('testRunner', {
  catalog: () => ipcRenderer.invoke('catalog'),
  run: selection => ipcRenderer.invoke('run', selection),
  openArtifact: kind => ipcRenderer.invoke('open-artifact', kind),
  onProgress: callback => ipcRenderer.on('progress', (_event, message) => callback(message))
});
