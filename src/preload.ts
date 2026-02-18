import { contextBridge, ipcRenderer, webUtils } from 'electron';

function getMediaUrl(filename: string): string {
  return `chatwrapped-media://media/${encodeURIComponent(filename)}`;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getMediaUrl,
  importZip: (file: File) => {
    const filePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke('import:start', filePath);
  },
  getThreads: (search?: string, sort?: 'recent' | 'name') =>
    ipcRenderer.invoke('db:getThreads', { search, sort }),
  getMessages: (threadId: string, limit: number, beforeTimestampMs?: number) =>
    ipcRenderer.invoke('db:getMessages', { threadId, limit, beforeTimestampMs }),
  getMessagesAfter: (threadId: string, afterTimestampMs: number, limit?: number) =>
    ipcRenderer.invoke('db:getMessagesAfter', { threadId, afterTimestampMs, limit }),
  getMessagesAroundTimestamp: (
    threadId: string,
    timestampMs: number,
    limitBefore?: number,
    limitAfter?: number
  ) =>
    ipcRenderer.invoke('db:getMessagesAroundTimestamp', {
      threadId,
      timestampMs,
      limitBefore,
      limitAfter,
    }),
  getMessagesAroundDate: (threadId: string, timestampMs: number, limit?: number) =>
    ipcRenderer.invoke('db:getMessagesAroundDate', { threadId, timestampMs, limit }),
  getMessageHistogram: (threadId: string) =>
    ipcRenderer.invoke('db:getMessageHistogram', { threadId }),
  searchMessages: (query: string, limit?: number) =>
    ipcRenderer.invoke('db:searchMessages', { query, limit }),
  getStats: () => ipcRenderer.invoke('db:getStats'),
  clearAllData: () => ipcRenderer.invoke('db:clearAllData'),
  onImportProgress: (callback: (p: { phase: string; current: number; total?: number; threadName?: string }) => void) => {
    const handler = (_: unknown, payload: { phase: string; current: number; total?: number; threadName?: string }) =>
      callback(payload);
    ipcRenderer.on('import:progress', handler);
    return () => {
      ipcRenderer.removeListener('import:progress', handler);
    };
  },
});
