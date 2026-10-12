import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onError: () => void
}

/** A failed model or WebGL context must not remove the readable portfolio. */
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onError()
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
