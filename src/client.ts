import { AqwasConnection } from "./connection.ts";
import { AqwasStore } from "./store.ts";
import type {
  AqwasClientConfig,
  ClientEvent,
  ConnectionState,
  DeleteMessage,
  EventCallback,
  ServerMessage,
  SetMessage,
} from "./types.ts";

export class AqwasClient {
  private config: AqwasClientConfig;
  private store: AqwasStore;
  private conn: AqwasConnection;

  private pendingMessages: Array<SetMessage | DeleteMessage> = [];
  private listeners = new Map<ClientEvent, Set<EventCallback<ClientEvent>>>();

  private syncResolve: (() => void) | null = null;
  private syncPromise: Promise<void>;

  constructor(config: AqwasClientConfig) {
    this.config = config;
    this.store = new AqwasStore();

    let resolveFn!: () => void;
    this.syncPromise = new Promise<void>((r) => (resolveFn = r));
    this.syncResolve = resolveFn;

    this.conn = new AqwasConnection(config, {
      onOpen: () => this.handleOpen(),
      onMessage: (data) => this.handleMessage(data),
      onClose: (code, reason) => this.handleClose(code, reason),
    });

    this.store.onObserve((key, value, oldValue) => {
      this.emit("change", key, value, oldValue);
    });
  }

  // ---- Public API ----

  get state(): ConnectionState {
    return this.conn.state;
  }

  connect(): Promise<void> {
    this.conn.connect();
    return this.syncPromise;
  }

  disconnect(): void {
    this.conn.disconnect();
    this.store.destroy();
    this.emit("destroyed", "client disconnect");
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get<T>(key);
  }

  set(key: string, value: unknown): void {
    if (this.config.exclude?.includes(key)) return;
    this.store.set(key, value);
    const msg: SetMessage = {
      type: "set",
      storeId: this.config.storeId,
      key,
      value,
    };
    this.sendOrBuffer(msg);
  }

  delete(key: string): void {
    this.store.delete(key);
    const msg: DeleteMessage = {
      type: "delete",
      storeId: this.config.storeId,
      key,
    };
    this.sendOrBuffer(msg);
  }

  getAll(): Record<string, unknown> {
    return this.store.getAll();
  }

  subscribe(
    key: string,
    cb: (value: unknown, oldValue: unknown) => void,
  ): () => void {
    return this.store.onObserve((k, value, oldValue) => {
      if (k === key) cb(value, oldValue);
    });
  }

  on<E extends ClientEvent>(event: E, cb: EventCallback<E>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as EventCallback<ClientEvent>);
    return () =>
      this.listeners.get(event)?.delete(cb as EventCallback<ClientEvent>);
  }

  // ---- Internal ----

  private handleOpen(): void {
    const msg: Record<string, unknown> = {
      type: "join",
      storeId: this.config.storeId,
    };
    if (this.config.ttl !== undefined) msg.ttl = this.config.ttl;
    if (this.config.persist !== undefined) msg.persist = this.config.persist;
    if (this.config.token !== undefined) msg.token = this.config.token;
    this.conn.send(JSON.stringify(msg));
  }

  private handleMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "sync": {
        this.store.applySync(msg.state);
        this.conn.markConnected();
        this.emit("connect");
        this.emit("sync", this.store.getAll());
        this.flushPending();
        if (this.syncResolve) {
          this.syncResolve();
          this.syncResolve = null;
        }
        break;
      }

      case "set": {
        this.store.applyRemoteSet(msg.key, msg.value);
        break;
      }

      case "delete": {
        this.store.applyRemoteDelete(msg.key);
        break;
      }

      case "error": {
        if (msg.code === "WRITE_DENIED") {
          // Request full state from server to restore authoritative state
          this.conn.send(
            JSON.stringify({ type: "sync", storeId: this.config.storeId }),
          );
          this.pendingMessages = [];
        }
        this.emit("error", msg.code, msg.message);
        break;
      }

      case "destroyed": {
        this.emit("destroyed", msg.reason);
        this.conn.disconnect();
        break;
      }

      case "pong":
        break;
    }
  }

  private handleClose(_code: number, _reason: string): void {
    this.emit("disconnect");

    let resolveFn!: () => void;
    this.syncPromise = new Promise<void>((r) => (resolveFn = r));
    this.syncResolve = resolveFn;
  }

  private sendOrBuffer(msg: SetMessage | DeleteMessage): void {
    if (this.conn.state === "connected") {
      this.conn.send(JSON.stringify(msg));
    } else {
      this.pendingMessages.push(msg);
    }
  }

  private flushPending(): void {
    for (const msg of this.pendingMessages) {
      this.conn.send(JSON.stringify(msg));
    }
    this.pendingMessages = [];
  }

  private emit<E extends ClientEvent>(
    event: E,
    ...args: Parameters<EventCallback<E>>
  ): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      // deno-lint-ignore no-explicit-any
      (cb as (...a: unknown[]) => void)(...(args as any[]));
    }
  }
}
