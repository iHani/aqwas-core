// ---- Config ----

export interface AqwasClientConfig {
  url: string;
  storeId: string;
  token?: string;
  persist?: boolean;
  ttl?: string;
  exclude?: string[];
  reconnect?: ReconnectConfig;
}

export interface ReconnectConfig {
  initialDelayMs?: number; // default: 1000
  maxDelayMs?: number; // default: 30000
  multiplier?: number; // default: 2
  maxAttempts?: number; // default: Infinity
}

// ---- Connection ----

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "joining"
  | "connected"
  | "reconnecting"
  | "destroyed";

// ---- Events ----

export type ClientEvent =
  | "connect"
  | "disconnect"
  | "sync"
  | "change"
  | "error"
  | "destroyed";

export type EventCallback<E extends ClientEvent> = E extends "connect"
  ? () => void
  : E extends "disconnect" ? () => void
  : E extends "sync" ? (state: Record<string, unknown>) => void
  : E extends "change"
    ? (key: string, value: unknown, oldValue: unknown) => void
  : E extends "error" ? (code: string, message: string) => void
  : E extends "destroyed" ? (reason: string) => void
  : never;

// ---- Client → Server messages ----

export interface JoinMessage {
  type: "join";
  storeId: string;
  token?: string;
  ttl?: string;
  persist?: boolean;
  exclude?: string[];
}

export interface SetMessage {
  type: "set";
  storeId: string;
  key: string;
  value: unknown;
}

export interface DeleteMessage {
  type: "delete";
  storeId: string;
  key: string;
}

export interface ResyncMessage {
  type: "sync";
  storeId: string;
}

export interface PingMessage {
  type: "ping";
}

// ---- Server → Client messages ----

export interface SyncMessage {
  type: "sync";
  storeId: string;
  seq: number;
  state: Record<string, unknown>;
  instanceId?: string;
}

export interface SetBroadcast {
  type: "set";
  storeId: string;
  seq: number;
  key: string;
  value: unknown;
}

export interface DeleteBroadcast {
  type: "delete";
  storeId: string;
  seq: number;
  key: string;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
  storeId?: string;
}

export interface DestroyedMessage {
  type: "destroyed";
  storeId: string;
  reason: string;
}

export type ServerMessage =
  | SyncMessage
  | SetBroadcast
  | DeleteBroadcast
  | ErrorMessage
  | DestroyedMessage
  | { type: "pong" };
