import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/conversation';

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

function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{msg.sender_name}</span>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(msg.timestamp_ms)}
        </span>
      </div>
      <p className="text-sm break-words whitespace-pre-wrap">
        {msg.content ?? (
          <span className="italic text-muted-foreground">[Media]</span>
        )}
      </p>
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
}

export function MessageView({ threadId, dateFilter }: MessageViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const scrollAdjustRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!threadId) {
      activeThreadIdRef.current = null;
      loadingMoreRef.current = false;
      setMessages([]);
      setHasMore(true);
      return;
    }

    activeThreadIdRef.current = threadId;
    loadingMoreRef.current = false;
    setMessages([]);
    scrollAdjustRef.current = null;
    didInitialScrollRef.current = false;

    if (dateFilter) {
      setLoading(true);
      setHasMore(false);
      const loadingForThreadId = threadId;
      window.electronAPI
        .getMessagesAroundDate(threadId, dateFilter.getTime(), 500)
        .then((data) => {
          if (activeThreadIdRef.current === loadingForThreadId) setMessages(data);
        })
        .finally(() => {
          if (activeThreadIdRef.current === loadingForThreadId) setLoading(false);
        });
    } else {
      setHasMore(true);
      loadMessages();
    }
  }, [threadId, dateFilter?.getTime(), loadMessages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || loadingMoreRef.current || !hasMore || messages.length === 0)
      return;
    const beforeTs = messages[0]?.timestamp_ms;
    if (beforeTs == null) return;
    const threshold = 100;
    const nearTop = el.scrollTop < threshold;
    if (nearTop) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      loadMessages(beforeTs).finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
    }
  }, [loading, hasMore, messages, loadMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => handleScroll();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [handleScroll]);

  const didInitialScrollRef = useRef(false);

  useEffect(() => {
    if (!threadId || loading || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    if (scrollAdjustRef.current) {
      const { prevScrollHeight, prevScrollTop } = scrollAdjustRef.current;
      scrollAdjustRef.current = null;
      el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight);
    } else if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [messages, loading, threadId]);

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
      className="flex flex-1 flex-col overflow-y-auto p-4"
    >
      {loading && messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {loadingMore && (
            <p className="sticky top-0 z-10 bg-background py-2 text-xs text-muted-foreground">
              Loading older…
            </p>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble msg={msg} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
