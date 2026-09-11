import { mount, installHmr } from '@kvantjs/ryvax.js/client';
import { Component, type ReactNode } from 'react';
import { DemoApp } from './demo.js';

class DashboardBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error.message : String(error) }; }
  render() { return this.state.error ? <div className="saas-loading"><strong>Workspace failed to load</strong><small>{this.state.error}</small></div> : this.props.children; }
}

installHmr();

if (document.querySelector('#saas-root')) mount(<DashboardBoundary><DemoApp /></DashboardBoundary>, '#saas-root');
