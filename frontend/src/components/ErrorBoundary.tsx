import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '3rem',
              maxWidth: '600px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={64} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
            <h1 style={{ marginBottom: '1rem', color: '#1e293b', fontSize: '1.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ marginBottom: '2rem', color: '#64748b' }}>
              We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  marginBottom: '2rem',
                  padding: '1rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    marginTop: '0.5rem',
                    overflow: 'auto',
                    color: '#ef4444',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              <RefreshCw size={20} />
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

