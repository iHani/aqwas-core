import type { AqwasClientConfig, ConnectionState, ReconnectConfig } from "./types.ts"

const DEFAULT_RECONNECT: Required<ReconnectConfig> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  maxAttempts: Infinity,
}

type ConnectionCallbacks = {
  onOpen: () => void
  onMessage: (data: string) => void
  onClose: (code: number, reason: string) => void
}

export class AqwasConnection {
  private config: AqwasClientConfig
  private reconnect: Required<ReconnectConfig>
  private callbacks: ConnectionCallbacks

  private ws: WebSocket | null = null
  private _state: ConnectionState = "disconnected"
  private intentionalClose = false
  private attempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: AqwasClientConfig, callbacks: ConnectionCallbacks) {
    this.config = config
    this.reconnect = { ...DEFAULT_RECONNECT, ...config.reconnect }
    this.callbacks = callbacks
  }

  get state(): ConnectionState {
    return this._state
  }

  connect(): void {
    if (this._state !== "disconnected" && this._state !== "reconnecting") return
    this.intentionalClose = false
    this.openSocket()
  }

  markConnected(): void {
    this._state = "connected"
    this.attempts = 0
  }

  markJoining(): void {
    this._state = "joining"
  }

  send(data: string): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
      return true
    }
    return false
  }

  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnectTimer()
    this._state = "destroyed"
    this.ws?.close(1000, "client disconnect")
    this.ws = null
  }

  private openSocket(): void {
    this._state = "connecting"
    const url = new URL(this.config.url)
    if (this.config.token) url.searchParams.set("token", this.config.token)

    const ws = new WebSocket(url.toString())
    this.ws = ws

    ws.onopen = () => {
      this._state = "joining"
      this.callbacks.onOpen()
    }

    ws.onmessage = (event) => {
      this.callbacks.onMessage(event.data as string)
    }

    ws.onclose = (event) => {
      const prevState = this._state
      this.ws = null

      if (this.intentionalClose) return

      this._state = "reconnecting"
      this.callbacks.onClose(event.code, event.reason)

      if (prevState === "destroyed") return
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose always fires after onerror — let it handle reconnect
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnect.maxAttempts !== Infinity && this.attempts >= this.reconnect.maxAttempts) {
      this._state = "destroyed"
      return
    }

    const delay = Math.min(
      this.reconnect.initialDelayMs * Math.pow(this.reconnect.multiplier, this.attempts),
      this.reconnect.maxDelayMs,
    )
    this.attempts++

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.intentionalClose) this.openSocket()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
