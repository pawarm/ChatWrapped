import { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

interface JumpToDateBarProps {
  threadId: string | null;
  visibleTimeRange: { startMs: number; endMs: number } | null;
  onJump: (timestampMs: number) => void;
}

function formatAxisDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const isThisYear = d.getFullYear() === now.getFullYear();
  return isThisYear
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export function JumpToDateBar({
  threadId,
  visibleTimeRange,
  onJump,
}: JumpToDateBarProps) {
  const [histogram, setHistogram] = useState<{
    minTimestampMs: number;
    maxTimestampMs: number;
    buckets: { binIndex: number; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredBin, setHoveredBin] = useState<{
    binIndex: number;
    timestampMs: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!threadId) {
      setHistogram(null);
      return;
    }
    setLoading(true);
    api
      .getMessageHistogram(threadId)
      .then((data) => {
        setHistogram(data ?? null);
      })
      .finally(() => setLoading(false));
  }, [threadId]);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!histogram || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const span = histogram.maxTimestampMs - histogram.minTimestampMs;
      if (span <= 0) return;
      const fraction = Math.max(0, Math.min(1, x / width));
      const timestampMs =
        histogram.minTimestampMs + fraction * span;
      onJump(timestampMs);
    },
    [histogram, onJump]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!histogram || !svgRef.current) {
        setHoveredBin(null);
        return;
      }
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const span = histogram.maxTimestampMs - histogram.minTimestampMs;
      if (span <= 0 || width <= 0) {
        setHoveredBin(null);
        return;
      }
      const fraction = Math.max(0, Math.min(1, x / width));
      const binIndex = Math.min(
        histogram.buckets.length - 1,
        Math.floor(fraction * histogram.buckets.length)
      );
      const bucketWidth = span / histogram.buckets.length;
      const timestampMs =
        histogram.minTimestampMs + (binIndex + 0.5) * bucketWidth;
      const count = histogram.buckets[binIndex]?.count ?? 0;
      setHoveredBin({ binIndex, timestampMs, count });
    },
    [histogram]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredBin(null);
  }, []);

  if (!threadId) return null;
  if (loading) {
    return (
      <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-border px-4">
        <Skeleton className="h-8 w-full max-w-2xl" />
      </div>
    );
  }
  if (!histogram || histogram.buckets.every((b) => b.count === 0)) {
    return (
      <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-border px-4 text-xs text-muted-foreground">
        No messages
      </div>
    );
  }

  const span = histogram.maxTimestampMs - histogram.minTimestampMs;
  const maxCount = Math.max(
    1,
    ...histogram.buckets.map((b) => b.count)
  );
  const barHeightPercent = (count: number) =>
    Math.max(2, (count / maxCount) * 100);

  const viewportLeft =
    span > 0 && visibleTimeRange
      ? Math.max(
          0,
          Math.min(
            100,
            ((visibleTimeRange.startMs - histogram.minTimestampMs) / span) * 100
          )
        )
      : null;
  const viewportWidth =
    span > 0 && visibleTimeRange && viewportLeft != null
      ? Math.max(
          0,
          Math.min(
            100 - viewportLeft,
            ((visibleTimeRange.endMs - visibleTimeRange.startMs) / span) * 100
          )
        )
      : null;

  return (
    <div className="relative flex h-14 w-full shrink-0 flex-col justify-center border-b border-border px-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatAxisDate(histogram.minTimestampMs)}
        </span>
        <div className="relative min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-10 w-full cursor-pointer"
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            role="img"
            aria-label="Timeline: click to jump to date"
          >
            <defs>
              <linearGradient
                id="histogramGradient"
                x1="0"
                x2="0"
                y1="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity="0.8"
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity="0.4"
                />
              </linearGradient>
            </defs>
            {histogram.buckets.map((b, i) => {
              const w = 100 / histogram.buckets.length;
              const x = (i / histogram.buckets.length) * 100;
              const h = barHeightPercent(b.count);
              const isHovered = hoveredBin?.binIndex === i;
              return (
                <rect
                  key={i}
                  x={x}
                  y={100 - h}
                  width={w + 0.5}
                  height={h}
                  fill="url(#histogramGradient)"
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-opacity"
                />
              );
            })}
            {viewportLeft != null &&
              viewportWidth != null &&
              viewportWidth > 0 && (
                <rect
                  x={viewportLeft}
                  y={0}
                  width={viewportWidth}
                  height={100}
                  fill="var(--primary)"
                  fillOpacity="0.15"
                  className="pointer-events-none"
                />
              )}
            {viewportLeft != null &&
              viewportWidth != null &&
              viewportWidth > 0 && (
                <>
                  <line
                    x1={viewportLeft}
                    y1={0}
                    x2={viewportLeft}
                    y2={100}
                    stroke="var(--primary)"
                    strokeWidth={0.5}
                    opacity={0.6}
                    className="pointer-events-none"
                  />
                  <line
                    x1={viewportLeft + viewportWidth}
                    y1={0}
                    x2={viewportLeft + viewportWidth}
                    y2={100}
                    stroke="var(--primary)"
                    strokeWidth={0.5}
                    opacity={0.6}
                    className="pointer-events-none"
                  />
                </>
              )}
          </svg>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatAxisDate(histogram.maxTimestampMs)}
        </span>
      </div>
      {hoveredBin && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 translate-y-0 rounded border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
          {formatAxisDate(hoveredBin.timestampMs)} · {hoveredBin.count}{' '}
          {hoveredBin.count === 1 ? 'message' : 'messages'}
        </div>
      )}
    </div>
  );
}
