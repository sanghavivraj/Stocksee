import { lazy, Suspense } from 'react';
import usePageSwitch from './hooks/usePageSwitch';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Every page except the landing page loads on first visit, so the first screen downloads less.
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));
const TipCheck = lazy(() => import('./pages/TipCheck'));
const Unusual = lazy(() => import('./pages/Unusual'));
const Compare = lazy(() => import('./pages/Compare'));
const Samajh = lazy(() => import('./pages/Samajh'));

const PageLoading = () => <div className="skeleton" style={{ height: 240, margin: '1rem 0' }} role="status" aria-label="Loading" />;

function AppRoutes() {
  // while leaving, the old page stays on screen for a moment; then the new one comes in
  const [view, leaving] = usePageSwitch(useLocation());
  return (
    <Layout>
      <div key={view.pathname} className={`page-view ${leaving ? 'is-leaving' : ''}`}>
        <ErrorBoundary resetKey={view.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Routes location={view}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/tip-check" element={<TipCheck />} />
              <Route path="/unusual" element={<Unusual />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/samajh" element={<Samajh />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/portfolio" element={<Navigate to="/watchlist" replace />} />
              <Route path="/markets" element={<Navigate to="/" replace />} />
              <Route path="/ask" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </Router>
  );
}

export default App;
