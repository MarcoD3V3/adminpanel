import { useEffect, useRef, type RefObject } from "react";

type UseInfiniteScrollOptions = {
  enabled?: boolean;
  rootMargin?: string;
};

export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** Sentinel renderizado en React (no appendChild manual). */
export function InfiniteScrollSentinel({
  onLoadMore,
  enabled = true,
  rootMargin = "200px",
}: {
  onLoadMore: () => void;
  enabled?: boolean;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const sentinel = ref.current;
    if (!sentinel || !enabled) return;

    const root = findScrollParent(sentinel);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { root, rootMargin, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return (
    <div
      ref={ref}
      className="infinite-scroll-sentinel"
      aria-hidden
      style={{ width: "100%", height: 1, gridColumn: "1 / -1", pointerEvents: "none" }}
    />
  );
}

/** Si el contenido no llena el área scrollable, pide más páginas hasta poder hacer scroll. */
export function useAutoFillScrollArea(
  anchorRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  { enabled = true, deps = [] }: { enabled?: boolean; deps?: unknown[] } = {}
) {
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const scrollParent = findScrollParent(anchor);
    const contentHeight = anchor.scrollHeight;
    const viewportHeight = scrollParent?.clientHeight ?? anchor.clientHeight;
    if (contentHeight <= viewportHeight + 32) {
      onLoadMoreRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, anchorRef, ...deps]);
}

export function useInfiniteScroll(
  anchorRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  { enabled = true, rootMargin = "200px" }: UseInfiniteScrollOptions = {}
) {
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !enabled) return;

    const root = findScrollParent(anchor) ?? null;
    const sentinel = document.createElement("div");
    sentinel.setAttribute("data-infinite-scroll-sentinel", "1");
    sentinel.style.width = "100%";
    sentinel.style.height = "1px";
    sentinel.style.gridColumn = "1 / -1";
    sentinel.style.pointerEvents = "none";
    anchor.appendChild(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { root, rootMargin, threshold: 0 }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, [anchorRef, enabled, rootMargin]);
}
