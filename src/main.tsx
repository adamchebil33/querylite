import { lazy, StrictMode, Suspense, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DropZone } from './components/DropZone';
import { Landing } from './components/Landing';
import './index.css';
import { APP_PATH, navigate, usePage } from './lib/router';
import { useApp } from './state/store';
import './state/theme';

// The benchmark page is separate from the app and only loaded when visited.
const BenchPage = lazy(() => import('./bench/BenchPage').then((m) => ({ default: m.BenchPage })));

function Root() {
  const page = usePage();

  useEffect(() => {
    if (page === 'bench') return;
    // Start the database right away, so it is ready by the time it is needed.
    useApp.getState().startEngine();
    // A share link carries its query in the URL fragment and opens in the editor.
    if (location.hash.includes('sql=')) {
      navigate(APP_PATH + location.hash, { replace: true });
      void useApp.getState().openSharedLink(location.hash);
    }
    // Runs once on first load; later page changes keep the same engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Files can be dropped on any page; they always open in the editor.
  const onFiles = useCallback((files: File[]) => {
    void useApp.getState().addFiles(files);
    navigate(APP_PATH);
  }, []);

  if (page === 'bench') {
    return (
      <Suspense fallback={null}>
        <BenchPage />
      </Suspense>
    );
  }
  return (
    <DropZone onFiles={onFiles}>
      {page === 'app' ? <App onFiles={onFiles} /> : <Landing onFiles={onFiles} />}
    </DropZone>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
