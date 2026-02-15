import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  importZip: (file: File) => {
    const filePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke('import:start', filePath);
  },
  onImportProgress: (callback: (p: { phase: string; current: number; total?: number; threadName?: string }) => void) => {
    const handler = (_: unknown, payload: { phase: string; current: number; total?: number; threadName?: string }) =>
      callback(payload);
    ipcRenderer.on('import:progress', handler);
    return () => {
      ipcRenderer.removeListener('import:progress', handler);
    };
  },
});
