import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageView } from '@/components/conversation/MessageView';
import { useDebounce } from '@/hooks/useDebounce';
import type { SearchResult, Thread } from '@/types/conversation';

type SortKind = 'recent' | 'name';

function formatSearchTimestamp(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const MSG_HASH_REGEX = /^#msg-(\d+)$/;

function getMessageTimestampFromUrl(
  hash: string,
  searchParams: URLSearchParams
): number | null {
  const hashMatch = hash.match(MSG_HASH_REGEX);
  if (hashMatch) {
    const ts = parseInt(hashMatch[1], 10);
    return Number.isNaN(ts) ? null : ts;
  }
  const q = searchParams.get('message');
  if (q) {
    const ts = parseInt(q, 10);
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

export function ConversationsPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { hash } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKind>('recent');
  const [messageSearch, setMessageSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const debouncedMessageSearch = useDebounce(messageSearch, 400);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getThreads(debouncedSearch, sort);
      setThreads(data);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (!debouncedMessageSearch.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    window.electronAPI
      .searchMessages(debouncedMessageSearch, 30)
      .then(setSearchResults)
      .finally(() => setSearching(false));
  }, [debouncedMessageSearch]);

  const handleSelectThread = useCallback(
    (id: string, messageTimestampMs?: number) => {
      setDateFilter(null);
      const path = `/conversations/${encodeURIComponent(id)}`;
      if (messageTimestampMs != null) {
        navigate(`${path}#msg-${messageTimestampMs}`);
      } else {
        navigate(path);
      }
    },
    [navigate]
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 w-full gap-0">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-border">
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <input
            type="search"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="search"
            placeholder="Search in messages…"
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-1">
            <Button
              variant={sort === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('recent')}
            >
              Recent
            </Button>
            <Button
              variant={sort === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('name')}
            >
              Name
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {debouncedMessageSearch.trim() ? (
            <div className="flex flex-col gap-1 p-3">
              {searching ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching messages</p>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      handleSelectThread(r.thread_id, r.timestamp_ms)
                    }
                    className="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <div className="font-medium text-primary">
                      {r.thread_title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.sender_name} · {formatSearchTimestamp(r.timestamp_ms)}
                    </div>
                    <div className="mt-0.5 truncate text-xs">
                      {r.snippet ?? r.content ?? ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : threads.length === 0 ? (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm text-muted-foreground">
                No conversations. Import your Messenger data first.
              </p>
              <Link to="/import">
                <Button size="sm">Import Data</Button>
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectThread(t.id)}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-accent ${
                      threadId === t.id
                        ? 'bg-accent font-medium'
                        : 'bg-transparent'
                    }`}
                  >
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(t.message_count ?? 0).toLocaleString()} messages
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {threadId && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
              {threads.find((t) => t.id === threadId)?.title ??
                searchResults.find((r) => r.thread_id === threadId)
                  ?.thread_title ??
                threadId}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              <label htmlFor="date-nav" className="text-xs text-muted-foreground">
                Jump to date
              </label>
              <input
                id="date-nav"
                type="date"
                value={
                  dateFilter
                    ? dateFilter.toISOString().slice(0, 10)
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setDateFilter(val ? new Date(val + 'T12:00:00') : null);
                  if (val) setSearchParams({});
                }}
                className="rounded border border-input bg-background px-2 py-1 text-xs"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter(null);
                    setSearchParams({});
                  }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
        <MessageView
          threadId={threadId ?? null}
          dateFilter={dateFilter}
          initialScrollToTimestampMs={
            threadId ? getMessageTimestampFromUrl(hash, searchParams) : null
          }
        />
      </main>
    </div>
  );
}
