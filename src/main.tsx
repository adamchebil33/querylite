import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import './state/theme';

// The benchmark page is separate from the app and only loaded when visited.
const BenchPage = lazy(() => import('./bench/BenchPage').then((m) => ({ default: m.BenchPage })));
const isBench = location.pathname.replace(/\/+$/, '') === '/bench';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBench ? (
      <Suspense fallback={null}>
        <BenchPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
