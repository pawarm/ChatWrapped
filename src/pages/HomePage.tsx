import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { StatsSummary } from '@/types/conversation';

function formatDateRange(firstMs: number | null, lastMs: number | null): string {
  if (firstMs == null || lastMs == null) return '—';
  const first = new Date(firstMs);
  const last = new Date(lastMs);
  return `${first.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasData = stats != null && stats.messageCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Welcome to ChatWrapped</h2>
      <p className="max-w-md text-muted-foreground">
        Import your Meta/Facebook Messenger export and explore your messaging
        history with search, browsing, and analytics. All data stays on your
        device.
      </p>

      {loading ? (
        <StatsSkeleton />
      ) : !hasData ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            No data imported yet. Import your Messenger export to see your
            conversations and statistics.
          </p>
          <Link to="/import">
            <Button>Import Messenger Data</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Conversations"
              value={stats.threadCount.toLocaleString()}
            />
            <StatCard
              label="Messages"
              value={stats.messageCount.toLocaleString()}
            />
            <StatCard
              label="Reactions"
              value={stats.reactionCount.toLocaleString()}
            />
            <StatCard
              label="Words"
              value={stats.wordCount.toLocaleString()}
            />
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date range
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatDateRange(stats.firstMessageAt, stats.lastMessageAt)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/conversations">
              <Button variant="outline">Browse conversations</Button>
            </Link>
            <Link to="/import">
              <Button variant="ghost" size="sm">
                Import more data
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
