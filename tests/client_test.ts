import { assertEquals, assertNotEquals } from "https://deno.land/std@0.220.0/assert/mod.ts"
import { AqwasClient } from "../src/client.ts"

// Integration tests — require a running server at WS_URL
// Start the server with: cd server && deno task dev
//
// These tests use persist: false to avoid Supabase calls.

const WS_URL = Deno.env.get("WS_URL") ?? "ws://localhost:3000/ws"

function storeId(name: string) {
  return `test/${name}-${crypto.randomUUID().slice(0, 8)}`
}

// Wait for WebSocket close handshake to complete so Deno's leak detector is happy
function close(client: AqwasClient): Promise<void> {
  client.disconnect()
  return new Promise((r) => setTimeout(r, 100))
}

function wait(ms = 150): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.test("Client: connect and sync", async () => {
  const client = new AqwasClient({ url: WS_URL, storeId: storeId("connect"), persist: false })

  await client.connect()
  assertEquals(client.state, "connected")

  await close(client)
})

Deno.test("Client: set and get after sync", async () => {
  const client = new AqwasClient({ url: WS_URL, storeId: storeId("set-get"), persist: false })
  await client.connect()

  client.set("score", 42)
  assertEquals(client.get("score"), 42)

  await close(client)
})

Deno.test("Client: two clients sync state", async () => {
  const id = storeId("two-clients")
  const c1 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  const c2 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })

  await c1.connect()
  c1.set("msg", "hello")

  await c2.connect()
  await wait()

  assertEquals(c2.get("msg"), "hello")

  await close(c1)
  await close(c2)
})

Deno.test("Client: concurrent sets converge via CRDT", async () => {
  const id = storeId("crdt")
  const c1 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  const c2 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })

  await c1.connect()
  await c2.connect()

  c1.set("key", "from-c1")
  c2.set("key", "from-c2")

  await wait(200)

  // Both clients converge to same value (CRDT last-write-wins by client ID)
  assertEquals(c1.get("key"), c2.get("key"))

  await close(c1)
  await close(c2)
})

Deno.test("Client: on('change') fires on remote update", async () => {
  const id = storeId("change-event")
  const c1 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  const c2 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })

  await c1.connect()
  await c2.connect()

  const changes: Array<{ key: string; value: unknown }> = []
  c2.on("change", (key, value) => changes.push({ key, value }))

  c1.set("x", 99)
  await wait()

  assertNotEquals(changes.length, 0)
  assertEquals(changes[changes.length - 1], { key: "x", value: 99 })

  await close(c1)
  await close(c2)
})

Deno.test("Client: subscribe to specific key", async () => {
  const id = storeId("subscribe")
  const client = new AqwasClient({ url: WS_URL, storeId: id, persist: false })

  await client.connect()

  const values: unknown[] = []
  const unsub = client.subscribe("counter", (v) => values.push(v))

  client.set("counter", 1)
  client.set("other", "ignored")
  client.set("counter", 2)

  assertEquals(values, [1, 2])

  unsub()
  client.set("counter", 3)
  assertEquals(values, [1, 2])

  await close(client)
})

Deno.test("Client: getAll returns merged state", async () => {
  const id = storeId("getall")
  const c1 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  const c2 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })

  await c1.connect()
  c1.set("a", 1)
  c1.set("b", 2)

  await c2.connect()
  await wait()

  const all = c2.getAll()
  assertEquals(all.a, 1)
  assertEquals(all.b, 2)

  await close(c1)
  await close(c2)
})

Deno.test("Client: on('sync') receives initial state", async () => {
  const id = storeId("sync-event")

  // Seed state with c1; keep connected so the in-memory store lives
  const c1 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  await c1.connect()
  c1.set("seed", true)

  // Wait for c1's update to reach the server
  await wait()

  const c2 = new AqwasClient({ url: WS_URL, storeId: id, persist: false })
  const synced: Array<Record<string, unknown>> = []
  c2.on("sync", (state) => synced.push(state))

  await c2.connect()

  assertEquals(synced.length, 1)
  assertEquals(synced[0].seed, true)

  await close(c1)
  await close(c2)
})

Deno.test("Client: exclude config skips sending excluded keys", async () => {
  const id = storeId("exclude")
  const client = new AqwasClient({
    url: WS_URL,
    storeId: id,
    persist: false,
    exclude: ["local"],
  })

  await client.connect()

  client.set("shared", "yes")
  // "local" is excluded — client.set() returns early, so it's never applied locally or sent
  client.set("local", "no")

  assertEquals(client.get("local"), undefined)
  assertEquals(client.get("shared"), "yes")

  await close(client)
})
