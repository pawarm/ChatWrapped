import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { StatsSummary } from '@/types/conversation';
import type { ZipInspectResult } from '@/types/import';

const META_ACCOUNTS_URL = 'https://accountscenter.facebook.com/';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface SelectedFile {
  path: string;
  name: string;
}

function fileKey(file: SelectedFile): string {
  return file.path;
}

export function ImportPage() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [storageSizeBytes, setStorageSizeBytes] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileDetails, setFileDetails] = useState<Record<string, ZipInspectResult | 'loading'>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    threadsImported: number;
    messagesImported: number;
    reactionsImported: number;
  } | null>(null);
  const [progress, setProgress] = useState<{
    phase: string;
    current: number;
    total?: number;
    threadName?: string;
    zipIndex?: number;
    zipTotal?: number;
  } | null>(null);

  const isPreviewStage = selectedFiles.length > 0 && !isImporting;
  const validFiles = selectedFiles.filter((f) => {
    const d = fileDetails[fileKey(f)];
    return d && d !== 'loading' && d.format === 'valid';
  });
  const hasMessageFiles = validFiles.some((f) => {
    const d = fileDetails[fileKey(f)];
    return d && d !== 'loading' && d.format === 'valid' && !d.mediaOnly;
  });
  const hasValidFiles = validFiles.length > 0 && hasMessageFiles;
  const isInspecting = selectedFiles.some((f) => fileDetails[fileKey(f)] === 'loading');

  useEffect(() => {
    if (selectedFiles.length === 0) return;

    const inspect = async (file: SelectedFile) => {
      const key = fileKey(file);
      setFileDetails((prev) => ({ ...prev, [key]: 'loading' }));
      try {
        const details = await api.inspectZip(file.path);
        setFileDetails((prev) => ({ ...prev, [key]: details }));
      } catch {
        setFileDetails((prev) => ({
          ...prev,
          [key]: { threadCount: 0, messageFileCount: 0, format: 'invalid' },
        }));
      }
    };

    for (const file of selectedFiles) {
      const key = fileKey(file);
      if (fileDetails[key] === undefined || fileDetails[key] === 'loading') {
        void inspect(file);
      }
    }
  }, [selectedFiles]);

  const addFilePaths = useCallback((paths: string[]) => {
    const zipPaths = paths.filter((p) => p.toLowerCase().endsWith('.zip'));
    if (zipPaths.length === 0) {
      setError('Please select ZIP files.');
      return;
    }
    setError(null);
    setResult(null);

    const newFiles: SelectedFile[] = zipPaths.map((p) => ({
      path: p,
      name: p.split('/').pop() ?? p,
    }));

    setSelectedFiles((prev) => {
      const prevKeys = new Set(prev.map(fileKey));
      const toAdd = newFiles.filter((f) => !prevKeys.has(fileKey(f)));
      return prev.length === 0 ? newFiles : [...prev, ...toAdd];
    });
  }, []);

  const removeFile = useCallback((file: SelectedFile) => {
    setSelectedFiles((prev) => prev.filter((f) => fileKey(f) !== fileKey(file)));
    setFileDetails((prev) => {
      const next = { ...prev };
      delete next[fileKey(file)];
      return next;
    });
  }, []);

  const handleCancelPreview = useCallback(() => {
    setSelectedFiles([]);
    setFileDetails({});
    setError(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!hasValidFiles) return;
    setError(null);
    setResult(null);
    setProgress(null);
    setIsImporting(true);

    const unsubscribe = await api.onImportProgress((p) => {
      setProgress({
        phase: p.phase,
        current: p.current,
        total: p.total,
        threadName: p.threadName,
        zipIndex: p.zipIndex,
        zipTotal: p.zipTotal,
      });
    });

    try {
      const paths = validFiles.map((f) => f.path);
      const data = await api.importZips(paths);
      setResult({
        threadsImported: data.threadsImported,
        messagesImported: data.messagesImported,
        reactionsImported: data.reactionsImported,
      });
      setSelectedFiles([]);
      setFileDetails({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unsubscribe();
      setIsImporting(false);
      setProgress(null);
    }
  }, [hasValidFiles, validFiles]);

  const handleSelectClick = async () => {
    if (isImporting) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'ZIP files', extensions: ['zip'] }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        addFilePaths(paths);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg && !msg.toLowerCase().includes('cancel')) {
        setError(`File dialog error: ${msg}`);
      }
    }
  };

  useEffect(() => {
    api.getStats().then(setStats);
  }, [result]);

  useEffect(() => {
    if (stats != null && stats.messageCount > 0) {
      api.getStorageSize().then(setStorageSizeBytes);
    } else {
      setStorageSizeBytes(null);
    }
  }, [stats?.messageCount, result]);

  const handleClearData = useCallback(async () => {
    if (
      !window.confirm(
        'This will permanently delete all imported conversations, messages, and reactions. This cannot be undone. Continue?'
      )
    ) {
      return;
    }
    setError(null);
    setIsClearing(true);
    try {
      await api.clearAllData();
      setStats({
        threadCount: 0,
        messageCount: 0,
        reactionCount: 0,
        wordCount: 0,
        firstMessageAt: null,
        lastMessageAt: null,
      });
      setStorageSizeBytes(null);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data.');
    } finally {
      setIsClearing(false);
    }
  }, []);

  const isDisabled = isImporting;
  const hasData = stats != null && stats.messageCount > 0;

  const progressLabel =
    progress?.phase === 'extracting'
      ? progress.zipTotal && progress.zipTotal > 1
        ? `Scanning ZIP ${progress.current} of ${progress.zipTotal}...`
        : 'Scanning ZIP...'
      : progress?.phase === 'parsing'
        ? `Parsing threads (${progress.current}${progress.total ? ` / ${progress.total}` : ''})...`
        : progress?.phase === 'writing'
          ? progress.threadName
            ? `Importing: ${progress.threadName}`
            : `Writing (${progress.current}${progress.total ? ` / ${progress.total}` : ''})...`
          : 'Importing...';

  const progressPercent =
    progress?.total && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="text-2xl font-semibold">Import Messenger Data</h2>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">How to get your data</h3>
        <p className="text-sm text-muted-foreground">
          Go to{' '}
          <a
            href={META_ACCOUNTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            Meta Accounts Center
          </a>{' '}
          → Your Information and Permissions → Download your Information.
          Choose &quot;Messages&quot;, JSON format, and your date range. After
          Meta prepares the export (typically 24–72 hours), download the ZIP
          file(s) and import them here.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Button
          type="button"
          onClick={handleSelectClick}
          disabled={isDisabled}
        >
          {selectedFiles.length > 0 ? 'Add more ZIP files' : 'Select ZIP files'}
        </Button>

        {!isPreviewStage && !isImporting && (
          <div
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors border-border hover:border-muted-foreground/50"
          >
            <p className="text-sm font-medium text-muted-foreground">
              Click the button above to select your ZIP files
            </p>
            <p className="text-xs text-muted-foreground">
              You can select multiple files at once
            </p>
          </div>
        )}

        {isPreviewStage && (
          <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium">Selected files</h3>
            <p className="text-xs text-muted-foreground">
              Review the files below. Remove any you don&apos;t want, then click
              Import to start.
            </p>
            <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {selectedFiles.map((file) => {
                const key = fileKey(file);
                const details = fileDetails[key];
                const isValid = details && details !== 'loading' && details.format === 'valid';
                const isMediaOnly = details && details !== 'loading' && details.mediaOnly === true;
                const isLoading = details === 'loading';

                return (
                  <li
                    key={key}
                    className={`flex items-center justify-between gap-2 rounded-md border p-3 text-sm ${
                      isValid ? (isMediaOnly ? 'border-border bg-muted/30' : 'border-border') : details && details !== 'loading' && details.format === 'invalid' ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isLoading && 'Inspecting…'}
                        {details && details !== 'loading' && details.format === 'valid' && !details.mediaOnly &&
                          `${details.threadCount} threads, ${details.messageFileCount} message files`}
                        {details && details !== 'loading' && details.format === 'valid' && details.mediaOnly &&
                          'Media only (photos, videos, etc.)'}
                        {details && details !== 'loading' && details.format === 'invalid' && 'Unrecognized format'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file)}
                      disabled={isImporting}
                      className="shrink-0"
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancelPreview}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={!hasValidFiles || isInspecting}
              >
                Import {validFiles.length} file{validFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {isImporting && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">
              {progressLabel}
            </p>
            {progressPercent != null && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {result && !error && (
          <p className="text-sm text-foreground" role="status">
            Imported: {result.threadsImported} threads, {result.messagesImported}{' '}
            messages
            {result.reactionsImported > 0 &&
              `, ${result.reactionsImported} reactions`}
          </p>
        )}

        {hasData && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium">Clear imported data</h3>
            <p className="text-sm text-muted-foreground">
              {storageSizeBytes != null ? (
                <>
                  Currently using {formatFileSize(storageSizeBytes)} of storage
                  (messages and media). Remove all conversations, messages, and
                  reactions from the database. You can import again afterwards.
                </>
              ) : (
                <>
                  Remove all conversations, messages, and reactions from the
                  database. You can import again afterwards.
                </>
              )}
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearData}
              disabled={isClearing || isImporting}
            >
              {isClearing ? 'Clearing…' : 'Clear all data'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
