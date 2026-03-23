import { APP_NAME, APP_TAGLINE } from './config';

export function App() {
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <img src="/favicon.svg" alt="" className="h-6 w-6" />
        <h1 className="text-lg font-semibold">{APP_NAME}</h1>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="max-w-md text-center text-slate-600 dark:text-slate-400">{APP_TAGLINE}</p>
      </main>
    </div>
  );
}
