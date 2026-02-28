import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversationsPage } from '@/pages/ConversationsPage';
import { HomePage } from '@/pages/HomePage';
import { ImportPage } from '@/pages/ImportPage';
import { StatsPage } from '@/pages/StatsPage';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
const root = createRoot(rootEl);
root.render(
  <ErrorBoundary>
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/conversations/:threadId" element={<ConversationsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  </ErrorBoundary>,
);
