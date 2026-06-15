import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = { children: ReactNode; name?: string }
type State = { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="empty-state" style={{ marginTop: 80 }}>
        <h2>Halaman tidak dapat dimuat</h2>
        <p>Terjadi kesalahan yang tidak terduga. Silakan coba lagi.</p>
        <button onClick={() => this.setState({ hasError: false, message: '' })}>
          <RefreshCw size={17} /> Coba lagi
        </button>
      </div>
    )
  }
}
