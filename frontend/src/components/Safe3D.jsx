import { Component } from 'react';

/**
 * A safety net around the 3D parts. If the 3D files cannot download (weak network) or the graphics card refuses to start,
 * the app must not crash: this shows the fallback (the 2D version) and tells the parent once.
 */
export default class Safe3D extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback || null : this.props.children;
  }
}
