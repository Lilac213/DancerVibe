import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  declare props: Readonly<ErrorBoundaryProps>;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          backgroundColor: '#09090b',
          color: '#e4e4e7',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{color: '#f87171', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold'}}>应用遇到了一些问题</h1>
          <div style={{
            backgroundColor: '#18181b',
            padding: '1rem',
            borderRadius: '0.5rem',
            maxWidth: '600px',
            overflow: 'auto',
            border: '1px solid #27272a'
          }}>
            <pre style={{margin: 0, fontSize: '0.875rem', color: '#a1a1aa'}}>{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#e4e4e7',
              color: '#09090b',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);