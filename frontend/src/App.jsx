import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Watchlist from './pages/Watchlist';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import TipCheck from './pages/TipCheck';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

function AppRoutes() {
  const location = useLocation();
  return (
    <Layout>
      <ErrorBoundary resetKey={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/tip-check" element={<TipCheck />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/portfolio" element={<Navigate to="/watchlist" replace />} />
          <Route path="/markets" element={<Navigate to="/" replace />} />
          <Route path="/ask" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
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
