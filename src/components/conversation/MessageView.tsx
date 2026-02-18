import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const VISIBLE_RANGE_THROTTLE_MS = 100;
import { Skeleton } from '@/components/ui/skeleton';
import type { MediaItem, Message } from '@/types/conversation';

function MediaSection({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => {
        const url = window.electronAPI.getMediaUrl(item.relative_path);
        if (item.media_type === 'photo' || item.media_type === 'gif' || item.media_type === 'sticker') {
          return (
            <img
              key={item.id}
              src={url}
              alt=""
              className="max-h-64 max-w-full rounded-lg object-contain"
            />
          );
        }
        if (item.media_type === 'video') {
          return (
            <video
              key={item.id}
              src={url}
              controls
              className="max-h-64 max-w-full rounded-lg"
            />
          );
        }
        if (item.media_type === 'audio') {
          return (
            <audio key={item.id} src={url} controls className="max-w-full" />
          );
        }
        if (item.media_type === 'file') {
          return (
            <a
              key={item.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50"
            >
              <span aria-hidden>📎</span>
              {item.relative_path}
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}

function MessageListSkeleton() {
  const widths = ['w-48', 'w-64', 'w-40', 'w-56', 'w-32', 'w-72', 'w-44'];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {widths.map((w, i) => (
        <div
          key={i}
          className={
            i % 2 === 0
              ? 'flex justify-start'
              : 'flex justify-end'
          }
        >
          <div
            className={`min-w-0 max-w-[80%] rounded-lg bg-muted/50 px-3 py-2`}
          >
            <Skeleton className={`h-3 ${w} mb-1.5`} />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

const MESSAGE_LIMIT = 50;

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (isThisYear) {
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayContent(msg: Message): { text: string; showEditedBadge: boolean } {
  const content = msg.content ?? '';
  const hasEditedSuffix = content.endsWith(' (edited)');
  const text = hasEditedSuffix ? content.slice(0, -9) : content;
  return { text, showEditedBadge: hasEditedSuffix };
}

function MessageBubble({ msg }: { msg: Message }) {
  const specialType = msg.special_type ?? 'generic';
  const { text: content, showEditedBadge } = displayContent(msg);

  // Group events: centered, muted pill
  if (specialType === 'group_event') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {content || '[System message]'}
        </span>
      </div>
    );
  }

  // Poll creation: slightly emphasized
  if (specialType === 'poll_creation') {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-muted-foreground/20 bg-muted/30 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{msg.sender_name}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(msg.timestamp_ms)}
            {showEditedBadge && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px]">edited</span>
            )}
          </span>
        </div>
        <p className="break-all text-sm whitespace-pre-wrap">
          {content ? (
            <>
              <span className="mr-1.5 text-muted-foreground" aria-hidden>📊</span>
              {content}
            </>
          ) : !msg.media?.length ? (
            <span className="italic text-muted-foreground">[Media]</span>
          ) : null}
        </p>
        {msg.media && msg.media.length > 0 && <MediaSection items={msg.media} />}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {Object.entries(
              msg.reactions.reduce<Record<string, string[]>>(
                (acc, { reaction, actor }) => {
                  if (!acc[reaction]) acc[reaction] = [];
                  acc[reaction].push(actor);
                  return acc;
                },
                {}
              )
            ).map(([r, actors]) => (
              <span key={r}>{r} {actors.join(', ')}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Poll vote: muted, smaller
  if (specialType === 'poll_vote') {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/30 px-3 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground">{msg.sender_name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(msg.timestamp_ms)}
          </span>
        </div>
        <p className="break-all whitespace-pre-wrap text-xs text-muted-foreground">
          {content || (!msg.media?.length ? '[Media]' : null)}
        </p>
        {msg.media && msg.media.length > 0 && <MediaSection items={msg.media} />}
      </div>
    );
  }

  // Live location: muted with hint
  if (specialType === 'live_location') {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/30 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground">{msg.sender_name}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(msg.timestamp_ms)}
            {showEditedBadge && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px]">edited</span>
            )}
          </span>
        </div>
        <p className="break-all whitespace-pre-wrap text-sm text-muted-foreground">
          <span className="mr-1.5" aria-hidden>📍</span>
          {content || '[Live location]'}
        </p>
        {msg.media && msg.media.length > 0 && <MediaSection items={msg.media} />}
      </div>
    );
  }

  // Share: link icon, standard layout
  if (specialType === 'share') {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{msg.sender_name}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(msg.timestamp_ms)}
            {showEditedBadge && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px]">edited</span>
            )}
          </span>
        </div>
        <p className="break-all text-sm whitespace-pre-wrap">
          <span className="mr-1.5 text-muted-foreground" aria-hidden>🔗</span>
          {content ?? (!msg.media?.length ? <span className="italic text-muted-foreground">[Link]</span> : null)}
        </p>
        {msg.media && msg.media.length > 0 && <MediaSection items={msg.media} />}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {Object.entries(
              msg.reactions.reduce<Record<string, string[]>>(
                (acc, { reaction, actor }) => {
                  if (!acc[reaction]) acc[reaction] = [];
                  acc[reaction].push(actor);
                  return acc;
                },
                {}
              )
            ).map(([r, actors]) => (
              <span key={r}>{r} {actors.join(', ')}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic / edited (when edited is primary and no other type): standard bubble with edited badge
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{msg.sender_name}</span>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(msg.timestamp_ms)}
          {showEditedBadge && (
            <span className="ml-1 rounded bg-muted px-1 text-[10px]">edited</span>
          )}
        </span>
      </div>
      {content ? (
        <p className="break-all text-sm whitespace-pre-wrap">{content}</p>
      ) : null}
      {msg.media && msg.media.length > 0 && <MediaSection items={msg.media} />}
      {!content && !msg.media?.length && (
        <p className="text-sm italic text-muted-foreground">[Media]</p>
      )}
      {msg.reactions && msg.reactions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {Object.entries(
            msg.reactions.reduce<Record<string, string[]>>(
              (acc, { reaction, actor }) => {
                if (!acc[reaction]) acc[reaction] = [];
                acc[reaction].push(actor);
                return acc;
              },
              {}
            )
          ).map(([reaction, actors]) => (
            <span key={reaction}>
              {reaction} {actors.join(', ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageViewProps {
  threadId: string | null;
  dateFilter?: Date | null;
  initialScrollToTimestampMs?: number | null;
  onVisibleTimeRangeChange?: (range: { startMs: number; endMs: number } | null) => void;
}

export function MessageView({ threadId, dateFilter, initialScrollToTimestampMs, onVisibleTimeRangeChange }: MessageViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreNewer, setLoadingMoreNewer] = useState(false);
  const loadingMoreRef = useRef(false);
  const loadingMoreNewerRef = useRef(false);
  const scrollAdjustRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const initialScrollToTimestampRef = useRef<number | null>(null);
  const onVisibleTimeRangeChangeRef = useRef(onVisibleTimeRangeChange);
  const visibleRangeThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onVisibleTimeRangeChangeRef.current = onVisibleTimeRangeChange;

  const getAnchorTimestamp = (): number =>
    initialScrollToTimestampMs ??
    dateFilter?.getTime() ??
    Date.now();

  const computeVisibleTimeRange = useCallback(() => {
    const el = scrollRef.current;
    const callback = onVisibleTimeRangeChangeRef.current;
    if (!el || !callback) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const candidates = el.querySelectorAll('[data-message-timestamp]');
    const timestamps: number[] = [];
    for (const node of candidates) {
      const el = node as HTMLElement;
      const childRect = el.getBoundingClientRect();
      const intersects =
        childRect.top < rect.bottom && childRect.bottom > rect.top;
      if (intersects) {
        const ts = parseInt(el.dataset.messageTimestamp ?? '0', 10);
        if (!Number.isNaN(ts)) timestamps.push(ts);
      }
    }
    if (timestamps.length === 0) {
      callback(null);
      return;
    }
    callback({
      startMs: Math.min(...timestamps),
      endMs: Math.max(...timestamps),
    });
  }, []);

  const scheduleVisibleRangeUpdate = useCallback(() => {
    if (visibleRangeThrottleRef.current) return;
    visibleRangeThrottleRef.current = setTimeout(() => {
      visibleRangeThrottleRef.current = null;
      computeVisibleTimeRange();
    }, VISIBLE_RANGE_THROTTLE_MS);
  }, [computeVisibleTimeRange]);

  const loadMessages = useCallback(
    async (beforeTimestampMs?: number): Promise<Message[]> => {
      if (!threadId) return [];
      const loadingForThreadId = threadId;
      if (beforeTimestampMs == null) setLoading(true);
      try {
        const batch = await window.electronAPI.getMessages(
          threadId,
          MESSAGE_LIMIT,
          beforeTimestampMs
        );
        if (activeThreadIdRef.current !== loadingForThreadId) return batch;
        if (beforeTimestampMs != null) {
          const el = scrollRef.current;
          if (el) {
            scrollAdjustRef.current = {
              prevScrollHeight: el.scrollHeight,
              prevScrollTop: el.scrollTop,
            };
          }
          const batchIds = new Set(batch.map((m) => m.id));
          setMessages((prev) => {
            const filtered = prev.filter((m) => !batchIds.has(m.id));
            return [...batch, ...filtered];
          });
        } else {
          setMessages(batch);
        }
        setHasMore(batch.length === MESSAGE_LIMIT);
        return batch;
      } finally {
        if (beforeTimestampMs == null && activeThreadIdRef.current === loadingForThreadId) {
          setLoading(false);
        }
      }
    },
    [threadId]
  );

  const loadMessagesAfter = useCallback(
    async (afterTimestampMs: number): Promise<Message[]> => {
      if (!threadId) return [];
      const loadingForThreadId = threadId;
      const batch = await window.electronAPI.getMessagesAfter(
        threadId,
        afterTimestampMs,
        MESSAGE_LIMIT
      );
      if (activeThreadIdRef.current !== loadingForThreadId) return batch;
      const batchIds = new Set(batch.map((m) => m.id));
      setMessages((prev) => {
        const filtered = prev.filter((m) => !batchIds.has(m.id));
        return [...filtered, ...batch];
      });
      setHasMoreNewer(batch.length === MESSAGE_LIMIT);
      return batch;
    },
    [threadId]
  );

  const loadMessagesAroundTimestamp = useCallback(
    async (timestampMs: number) => {
      if (!threadId) return;
      const loadingForThreadId = threadId;
      setLoading(true);
      setHasMore(true);
      setHasMoreNewer(true);
      initialScrollToTimestampRef.current = timestampMs;
      try {
        const data = await window.electronAPI.getMessagesAroundTimestamp(
          threadId,
          timestampMs,
          MESSAGE_LIMIT,
          MESSAGE_LIMIT
        );
        if (activeThreadIdRef.current === loadingForThreadId) setMessages(data);
      } finally {
        if (activeThreadIdRef.current === loadingForThreadId) setLoading(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    if (!threadId) {
      activeThreadIdRef.current = null;
      loadingMoreRef.current = false;
      loadingMoreNewerRef.current = false;
      setMessages([]);
      setHasMore(true);
      setHasMoreNewer(false);
      return;
    }

    activeThreadIdRef.current = threadId;
    loadingMoreRef.current = false;
    loadingMoreNewerRef.current = false;
    setMessages([]);
    scrollAdjustRef.current = null;
    didInitialScrollRef.current = false;
    initialScrollToTimestampRef.current = null;

    const el = scrollRef.current;
    if (el) el.scrollTop = 0;

    loadMessagesAroundTimestamp(getAnchorTimestamp());
  }, [
    threadId,
    initialScrollToTimestampMs ?? null,
    dateFilter?.getTime() ?? null,
    loadMessagesAroundTimestamp,
  ]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || messages.length === 0) return;

    scheduleVisibleRangeUpdate();

    const threshold = 100;
    const nearTop = el.scrollTop < threshold;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    if (nearTop && !loadingMoreRef.current && hasMore) {
      const beforeTs = messages[0]?.timestamp_ms;
      if (beforeTs != null) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        loadMessages(beforeTs).finally(() => {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
      }
    }

    if (nearBottom && hasMoreNewer && !loadingMoreNewerRef.current) {
      const afterTs = messages[messages.length - 1]?.timestamp_ms;
      if (afterTs != null) {
        loadingMoreNewerRef.current = true;
        setLoadingMoreNewer(true);
        loadMessagesAfter(afterTs).finally(() => {
          loadingMoreNewerRef.current = false;
          setLoadingMoreNewer(false);
        });
      }
    }
  }, [loading, hasMore, hasMoreNewer, messages, loadMessages, loadMessagesAfter, scheduleVisibleRangeUpdate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => handleScroll();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [handleScroll]);

  const didInitialScrollRef = useRef(false);

  useLayoutEffect(() => {
    if (!threadId || loading || messages.length === 0) {
      onVisibleTimeRangeChangeRef.current?.(null);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;

    if (scrollAdjustRef.current) {
      const { prevScrollHeight, prevScrollTop } = scrollAdjustRef.current;
      scrollAdjustRef.current = null;
      el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight);
    } else if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      const targetTs = initialScrollToTimestampRef.current;
      if (targetTs != null) {
        const candidates = Array.from(
          el.querySelectorAll('[data-message-timestamp]')
        ) as HTMLElement[];
        const targetEl =
          candidates.find(
            (n) => parseInt(n.dataset.messageTimestamp ?? '0', 10) === targetTs
          ) ??
          candidates.find(
            (n) => parseInt(n.dataset.messageTimestamp ?? '0', 10) >= targetTs
          ) ??
          candidates[candidates.length - 1];
        if (targetEl) targetEl.scrollIntoView({ block: 'center' });
        initialScrollToTimestampRef.current = null;
      } else {
        el.scrollTop = el.scrollHeight - el.clientHeight;
      }
    }
    computeVisibleTimeRange();
  }, [messages, loading, threadId, computeVisibleTimeRange]);

  useEffect(() => {
    if (!threadId) didInitialScrollRef.current = false;
  }, [threadId]);

  if (!threadId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a conversation
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4"
    >
      {loading && messages.length === 0 ? (
        <MessageListSkeleton />
      ) : (
        <>
          {loadingMore && (
            <p className="sticky top-0 z-10 bg-background py-2 text-xs text-muted-foreground">
              Loading older…
            </p>
          )}
          {loadingMoreNewer && (
            <p className="sticky bottom-0 z-10 bg-background py-2 text-xs text-muted-foreground">
              Loading newer…
            </p>
          )}
          <div className="flex min-w-0 flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                data-message-timestamp={msg.timestamp_ms}
                className="min-w-0"
              >
                <MessageBubble msg={msg} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
