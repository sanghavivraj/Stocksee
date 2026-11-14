import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Catches render errors so one broken component shows a friendly message instead of a blank page. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating to another page clears the error
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="editorial-page-container">
        <div className="state-box" role="alert">
          <AlertTriangle size={28} aria-hidden="true" />
          <h2>Something went wrong on this page</h2>
          <p>Your watchlist and alerts are safe. Try again, or go back to the dashboard.</p>
          <div className="state-actions">
            <button type="button" className="btn-editorial btn-editorial-primary" onClick={() => this.setState({ error: null })}>Try again</button>
            <a className="btn-editorial btn-editorial-secondary" href="/">Go to dashboard</a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
