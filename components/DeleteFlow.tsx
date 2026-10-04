'use client';

// Shared delete flow:
// - useGuard(): blocks double-clicks / concurrent mutations (1 click = 1 action)
// - useUndoDelete(): optimistic remove + 5s undo window before the real delete
// - DeleteConfirm: centered confirmation modal ("Yes, delete" / "Cancel")
// - UndoToast: bottom toast with countdown + Undo button

import { useEffect, useRef, useState } from 'react';
import { Btn } from './ui';

// ── 1-click guard ────────────────────────────────────────────────────────────
export function useGuard() {
  const busy = useRef(false);
  return async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  };
}

// ── undoable delete ──────────────────────────────────────────────────────────
export function useUndoDelete<T>(performDelete: (item: T) => Promise<void>, seconds = 5) {
  const [pending, setPending] = useState<{ label: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<T | null>(null);
  const deleteRef = useRef(performDelete);
  deleteRef.current = performDelete;

  const flushNow = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const it = itemRef.current;
    itemRef.current = null;
    setPending(null);
    if (it) await deleteRef.current(it);
  };

  // If the component unmounts with a pending delete, finish it for real.
  useEffect(
    () => () => {
      if (itemRef.current) {
        const it = itemRef.current;
        itemRef.current = null;
        deleteRef.current(it);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const schedule = (item: T, label: string, onOptimisticRemove: () => void) => {
    // A second delete flushes the first one immediately — only one undo at a time.
    if (itemRef.current) {
      const prev = itemRef.current;
      itemRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      deleteRef.current(prev);
    }
    onOptimisticRemove();
    itemRef.current = item;
    setPending({ label });
    timerRef.current = setTimeout(() => {
      flushNow();
    }, seconds * 1000);
  };

  const undo = (onRestore: (item: T) => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const it = itemRef.current;
    itemRef.current = null;
    setPending(null);
    if (it) onRestore(it);
  };

  return { pending, seconds, schedule, undo };
}

// ── centered confirmation modal ──────────────────────────────────────────────
export function DeleteConfirm({
  title,
  message,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-sm rounded-[24px] bg-[var(--c-surface-solid)] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-[26px]">
          🗑
        </div>
        <h3 className="font-display text-[17px] font-extrabold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-btn border border-line bg-[var(--c-surface-solid)] px-4 py-2.5 text-[13.5px] font-bold text-ink hover:bg-soft"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-btn bg-danger px-4 py-2.5 text-[13.5px] font-extrabold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── undo toast ───────────────────────────────────────────────────────────────
export function UndoToast({ label, seconds, onUndo }: { label: string; seconds: number; onUndo: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const iv = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(iv);
  }, [seconds, label]);
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="glass flex items-center gap-3 !rounded-full py-2.5 pl-5 pr-2.5 shadow-2xl">
        <p className="max-w-[220px] truncate text-[13px] font-bold text-ink">
          “{label}” deleted
        </p>
        <span className="font-mono text-[12px] font-bold text-muted">{left}s</span>
        <Btn size="sm" onClick={onUndo} className="!rounded-full">
          Undo
        </Btn>
      </div>
    </div>
  );
}

