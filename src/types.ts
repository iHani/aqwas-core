// ---- Config ----

export interface AqwasClientConfig {
  url: string
  storeId: string
  token?: string
  persist?: boolean
  ttl?: string
  exclude?: string[]
  reconnect?: ReconnectConfig
}

export interface ReconnectConfig {
  initialDelayMs?: number   // default: 1000
  maxDelayMs?: number       // default: 30000
  multiplier?: number       // default: 2
  maxAttempts?: number      // default: Infinity
}

// ---- Connection ----

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "joining"
  | "connected"
  | "reconnecting"
  | "destroyed"

// ---- Events ----

export type ClientEvent = "connect" | "disconnect" | "sync" | "change" | "error" | "destroyed"

export type EventCallback<E extends ClientEvent> =
  E extends "connect"    ? () => void :
  E extends "disconnect" ? () => void :
  E extends "sync"       ? (state: Record<string, unknown>) => void :
  E extends "change"     ? (key: string, value: unknown, oldValue: unknown) => void :
  E extends "error"      ? (code: string, message: string) => void :
  E extends "destroyed"  ? (reason: string) => void :
  never

// ---- Server → Client messages ----

export interface SyncStateMessage {
  type: "sync-state"
  storeId: string
  seq: number
  state: number[]
  stateVector: number[]
}

export interface StateMessage {
  type: "state"
  storeId: string
  seq: number
  update: number[]
}

export interface ErrorMessage {
  type: "error"
  code: string
  message: string
  storeId?: string
}

export interface DestroyedMessage {
  type: "destroyed"
  storeId: string
  reason: string
}

export type ServerMessage =
  | SyncStateMessage
  | StateMessage
  | ErrorMessage
  | DestroyedMessage
  | { type: "pong" }
