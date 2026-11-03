export default function Loading() {
  return (
    <div className="flex min-h-72 items-center justify-center border-[3px] border-edge bg-card shadow-[6px_6px_0_0_var(--color-shadow)]" role="status" aria-live="polite">
      <p className="font-display text-[10px] text-ink-soft uppercase">Loading OmniToolz…</p>
    </div>
  );
}
