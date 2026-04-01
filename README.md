# @aqwas/core

Vanilla TypeScript client for [Aqwas](https://github.com/iHani/aqwas-core) — a distributed, real-time state service built on CRDT. Multiple clients, zero conflicts, offline-first.

Works in **Node.js**, **browsers**, **Deno**, and **Bun**.

## Install

```sh
npm install @aqwas/core
# or
pnpm add @aqwas/core
# or
bun add @aqwas/core
```

**Deno (JSR)**
```ts
import { AqwasClient } from "jsr:@aqwas/core"
```

## Quick Start

```ts
import { AqwasClient } from "@aqwas/core"

const client = new AqwasClient({
  url: "ws://localhost:3000/ws",
  storeId: "my-app/room-1",
})

await client.connect()

// Write state — applies locally instantly, syncs to server async
client.set("score", 100)
client.set("player", { name: "Alice", level: 5 })

// Read state
console.log(client.get("score"))   // 100
console.log(client.getAll())       // { score: 100, player: { ... } }

// Subscribe to a specific key
const unsub = client.subscribe("score", (value, oldValue) => {
  console.log(`score: ${oldValue} → ${value}`)
})

// Listen to any change (local or from another client)
client.on("change", (key, value, oldValue) => {
  console.log(key, "changed")
})

unsub()
client.disconnect()
```

## How It Works

**Optimistic updates.** `set()` writes to the local [Yjs](https://yjs.dev) CRDT document immediately — the UI never waits for a server round-trip. The binary update is sent to the server in the background.

**Automatic conflict resolution.** Concurrent writes from multiple clients are merged by the CRDT. There are no "resolve conflict" dialogs and no last-write-wins data loss. All clients converge to the same state.

**Offline buffering.** Writes made while disconnected are queued. On reconnect, all pending updates are merged into a single CRDT update and flushed — no data is lost.

**Automatic reconnect.** Exponential backoff with configurable limits. `connect()` resolves again after each successful reconnect.

## API

### `new AqwasClient(config)`

```ts
const client = new AqwasClient({
  url: "ws://your-server/ws",
  storeId: "app/room-42",
  token: "aq_live_...",      // optional auth token
  persist: true,             // persist store to DB (server default if omitted)
  ttl: "24h",                // store TTL: "30m", "7d", etc.
  exclude: ["localDraft"],   // keys that stay local, never sent to server
  reconnect: {
    initialDelayMs: 1000,    // default
    maxDelayMs: 30000,       // default
    multiplier: 2,           // default
    maxAttempts: Infinity,   // default
  },
})
```

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | WebSocket URL of the Aqwas server |
| `storeId` | `string` | Unique store identifier, e.g. `"game/lobby-42"` |
| `token` | `string` | Auth token for permission-scoped access |
| `persist` | `boolean` | Whether the server persists this store to the database |
| `ttl` | `string` | How long the server keeps the store alive after last connection |
| `exclude` | `string[]` | Keys that are written locally but never sent to the server |
| `reconnect` | `ReconnectConfig` | Backoff settings for automatic reconnection |

---

### `client.connect(): Promise<void>`

Opens the WebSocket and resolves once the initial state has been received from the server. Always `await` this before reading or writing if you need the latest server state.

```ts
await client.connect()
// state is now in sync
```

### `client.disconnect(): void`

Closes the connection permanently. No further reconnects.

---

### `client.set(key, value): void`

Writes `value` for `key`. Applies to the local CRDT immediately; syncs to the server asynchronously. If the client is offline, the update is buffered until reconnect.

```ts
client.set("position", { x: 10, y: 20 })
client.set("count", client.get<number>("count")! + 1)
```

### `client.get<T>(key): T | undefined`

Returns the current local value for `key`.

```ts
const pos = client.get<{ x: number; y: number }>("position")
```

### `client.delete(key): void`

Removes `key` from the store locally and on the server.

### `client.getAll(): Record<string, unknown>`

Returns a shallow snapshot of the entire store as a plain object.

---

### `client.subscribe(key, callback): () => void`

Fires `callback(value, oldValue)` whenever `key` changes — from local writes or incoming server updates. Returns an unsubscribe function.

```ts
const unsub = client.subscribe("cursor", (pos) => renderCursor(pos))

// stop listening
unsub()
```

### `client.on(event, callback): () => void`

Listens for lifecycle events. Returns an unsubscribe function.

```ts
client.on("connect", () => console.log("synced"))
client.on("disconnect", () => showOfflineBanner())
client.on("change", (key, value, oldValue) => console.log(key, value))
client.on("error", (code, message) => console.error(code, message))
client.on("destroyed", (reason) => console.warn("store destroyed:", reason))
```

| Event | Callback | Fires when |
|-------|----------|------------|
| `connect` | `() => void` | Connected and initial sync complete |
| `disconnect` | `() => void` | Connection lost (reconnect may follow) |
| `sync` | `(state: Record<string, unknown>) => void` | Full state snapshot received |
| `change` | `(key, value, oldValue) => void` | Any key changed, local or remote |
| `error` | `(code: string, message: string) => void` | Server sent an error |
| `destroyed` | `(reason: string) => void` | Store was destroyed by the server |

### `client.state: ConnectionState`

Read-only. One of:

```
"disconnected" → "connecting" → "joining" → "connected"
                                                  ↓
                                           "reconnecting"
                                                  ↓
                                            "destroyed"
```

## TypeScript

All types are included. No `@types/` package needed.

```ts
import type {
  AqwasClientConfig,
  ConnectionState,
  ClientEvent,
  ReconnectConfig,
} from "@aqwas/core"
```

## License

MIT
