import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  importZip: (file: File) => {
    const filePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke('import:start', filePath);
  },
  getThreads: (search?: string, sort?: 'recent' | 'name') =>
    ipcRenderer.invoke('db:getThreads', { search, sort }),
  getMessages: (threadId: string, limit: number, beforeTimestampMs?: number) =>
    ipcRenderer.invoke('db:getMessages', { threadId, limit, beforeTimestampMs }),
  getMessagesAroundDate: (threadId: string, timestampMs: number, limit?: number) =>
    ipcRenderer.invoke('db:getMessagesAroundDate', { threadId, timestampMs, limit }),
  searchMessages: (query: string, limit?: number) =>
    ipcRenderer.invoke('db:searchMessages', { query, limit }),
  onImportProgress: (callback: (p: { phase: string; current: number; total?: number; threadName?: string }) => void) => {
    const handler = (_: unknown, payload: { phase: string; current: number; total?: number; threadName?: string }) =>
      callback(payload);
    ipcRenderer.on('import:progress', handler);
    return () => {
      ipcRenderer.removeListener('import:progress', handler);
    };
  },
  getTopSenders: (ownName?: string) => ipcRenderer.invoke('db:getTopSenders', ownName),
});
