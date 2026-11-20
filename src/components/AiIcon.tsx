/** The gold mark shown on every AI feature, so they stand apart from the rest of the editor. */
export function AiIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`shrink-0 fill-ai ${className}`}>
      {/* A large four-pointed star and a small one. */}
      <path d="M6.5 1.5 7.9 5.6 12 7l-4.1 1.4-1.4 4.1-1.4-4.1L1 7l4.1-1.4z" />
      <path d="M12.5 10l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" />
    </svg>
  );
}
