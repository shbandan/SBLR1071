import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown runtime error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled React runtime error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a1b3a 0%, #0e2855 55%, #133575 100%)',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '720px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              padding: '28px',
              color: '#1c2432',
            }}
          >
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.4rem' }}>Application Error</h2>
            <p style={{ margin: '0 0 14px 0', lineHeight: 1.5 }}>
              The page failed to render due to a runtime error. Please reload the page. If this keeps happening,
              contact your administrator.
            </p>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.9rem', color: '#5a6475' }}>
              Error: {this.state.errorMessage}
            </p>
            <button onClick={this.handleReload}>Reload Page</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
