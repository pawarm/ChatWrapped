import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { StatsSummary } from '@/types/conversation';

const META_ACCOUNTS_URL = 'https://accountscenter.facebook.com/';

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFileName, setDroppedFileName] = useState<string | null>(null);
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
  } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a ZIP file.');
      return;
    }
    setError(null);
    setResult(null);
    setProgress(null);
    setIsImporting(true);
    setDroppedFileName(file.name);

    const unsubscribe = window.electronAPI.onImportProgress((p) => {
      setProgress({
        phase: p.phase,
        current: p.current,
        total: p.total,
        threadName: p.threadName,
      });
    });

    try {
      const data = await window.electronAPI.importZip(file);
      setResult({
        threadsImported: data.threadsImported,
        messagesImported: data.messagesImported,
        reactionsImported: data.reactionsImported,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      unsubscribe();
      setIsImporting(false);
      setProgress(null);
    }
  }, []);

  const handleSelectClick = () => {
    if (!isImporting) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isImporting) {
      setIsDragging(true);
    }
  }, [isImporting]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isImporting) return;
      const file = e.dataTransfer.files?.[0];
      if (file) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          handleFile(file);
        } else {
          setError('Please drop a ZIP file.');
        }
      }
    },
    [handleFile, isImporting]
  );

  useEffect(() => {
    window.electronAPI.getStats().then(setStats);
  }, [result]);

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
      await window.electronAPI.clearAllData();
      setStats({
        threadCount: 0,
        messageCount: 0,
        reactionCount: 0,
        wordCount: 0,
        firstMessageAt: null,
        lastMessageAt: null,
      });
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
      ? 'Extracting ZIP...'
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
          Meta prepares the export (typically 24–72 hours), download the ZIP file
          and import it here.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Button
          type="button"
          onClick={handleSelectClick}
          disabled={isDisabled}
        >
          Select ZIP file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
          disabled={isDisabled}
        />

        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectClick();
            }
          }}
          aria-disabled={isDisabled}
          className={`flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragging && !isDisabled
              ? 'border-primary bg-accent'
              : 'border-border hover:border-muted-foreground/50'
          } ${isDisabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          {isImporting ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {progressLabel}
              </p>
              {progressPercent != null && (
                <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                Drop your messages ZIP here
              </p>
              <p className="text-xs text-muted-foreground">
                or click the button above to browse
              </p>
              {droppedFileName && (
                <p className="mt-2 text-sm text-foreground">
                  Selected: {droppedFileName}
                </p>
              )}
            </>
          )}
        </div>

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
              Remove all conversations, messages, and reactions from the database.
              You can import again afterwards.
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
