import { navigate } from '../lib/router';
import { useTheme } from '../state/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="p-1 text-muted hover:text-ink"
    >
      {/* Half-filled circle: reads as "contrast" in both modes. */}
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
        <circle cx="8" cy="8" r="6.250" fill="none" stroke="currentColor" strokeWidth="1.500" />
        <path d="M8 1.750a6.250 6.250 0 0 1 0 12.500z" fill="currentColor" />
      </svg>
    </button>
  );
}

/** The product name as a lowercase monospace wordmark that links home. */
export function Wordmark({ name }: { name: string }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        // Let modified clicks (new tab, etc.) behave normally.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate('/');
      }}
      className="font-mono text-[15px] font-semibold tracking-tight lowercase"
    >
      {name}
      <span className="text-accent" aria-hidden>
        _
      </span>
    </a>
  );
}
