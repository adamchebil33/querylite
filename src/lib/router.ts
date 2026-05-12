import { useSyncExternalStore } from 'react';

/**
 * A three-page app doesn't need a routing library: the current path is read
 * from the address bar and pages switch without reloading, so the database
 * (and any loaded data) survives moving between the landing page and the editor.
 */
export type Page = 'landing' | 'app' | 'bench';

export const APP_PATH = '/app';

export function pageFor(pathname: string): Page {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/bench') return 'bench';
  if (path === APP_PATH) return 'app';
  return 'landing';
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function usePage(): Page {
  return pageFor(useSyncExternalStore(subscribe, () => location.pathname));
}

/** Goes to another page of the app without a reload. */
export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.hash) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
