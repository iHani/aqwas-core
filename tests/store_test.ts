import { assertEquals, assertNotEquals } from "https://deno.land/std@0.220.0/assert/mod.ts"
import * as Y from "yjs"
import { AqwasStore } from "../src/store.ts"

Deno.test("Store: get/set/delete basic ops", () => {
  const store = new AqwasStore()

  store.set("score", 100)
  assertEquals(store.get("score"), 100)

  store.set("name", "Alice")
  assertEquals(store.get("name"), "Alice")

  store.delete("score")
  assertEquals(store.get("score"), undefined)

  store.destroy()
})

Deno.test("Store: getAll returns plain object", () => {
  const store = new AqwasStore()
  store.set("a", 1)
  store.set("b", "hello")

  const all = store.getAll()
  assertEquals(all, { a: 1, b: "hello" })

  store.destroy()
})

Deno.test("Store: applyLocalTransaction returns binary update", () => {
  const store = new AqwasStore()
  const update = store.set("x", 42)

  assertEquals(update instanceof Uint8Array, true)
  assertNotEquals(update.length, 0)

  // Apply to a fresh doc and verify convergence
  const other = new Y.Doc()
  Y.applyUpdate(other, update)
  assertEquals(other.getMap("state").get("x"), 42)

  store.destroy()
  other.destroy()
})

Deno.test("Store: applyRemoteUpdate merges correctly", () => {
  const store1 = new AqwasStore()
  const store2 = new AqwasStore()

  const update1 = store1.set("a", 1)
  const update2 = store2.set("b", 2)

  store1.applyRemoteUpdate(update2)
  store2.applyRemoteUpdate(update1)

  assertEquals(store1.get("a"), 1)
  assertEquals(store1.get("b"), 2)
  assertEquals(store2.get("a"), 1)
  assertEquals(store2.get("b"), 2)

  store1.destroy()
  store2.destroy()
})

Deno.test("Store: CRDT convergence on concurrent same-key set", () => {
  const store1 = new AqwasStore()
  const store2 = new AqwasStore()

  // Both set same key concurrently
  const u1 = store1.set("key", "from-store1")
  const u2 = store2.set("key", "from-store2")

  store1.applyRemoteUpdate(u2)
  store2.applyRemoteUpdate(u1)

  // Both converge to the same value (CRDT last-write-wins by client ID)
  assertEquals(store1.get("key"), store2.get("key"))

  store1.destroy()
  store2.destroy()
})

Deno.test("Store: onObserve fires on local set", () => {
  const store = new AqwasStore()
  const events: Array<{ key: string; value: unknown }> = []

  store.onObserve((key, value) => events.push({ key, value }))
  store.set("score", 99)

  assertEquals(events.length, 1)
  assertEquals(events[0], { key: "score", value: 99 })

  store.destroy()
})

Deno.test("Store: onObserve fires on remote update", () => {
  const store1 = new AqwasStore()
  const store2 = new AqwasStore()

  const events: Array<{ key: string; value: unknown }> = []
  store2.onObserve((key, value) => events.push({ key, value }))

  const update = store1.set("msg", "hello")
  store2.applyRemoteUpdate(update)

  assertEquals(events.length, 1)
  assertEquals(events[0], { key: "msg", value: "hello" })

  store1.destroy()
  store2.destroy()
})

Deno.test("Store: onObserve unsubscribe stops callbacks", () => {
  const store = new AqwasStore()
  let count = 0

  const unsub = store.onObserve(() => count++)
  store.set("a", 1)
  assertEquals(count, 1)

  unsub()
  store.set("b", 2)
  assertEquals(count, 1)

  store.destroy()
})

Deno.test("Store: encodeStateAsUpdate round-trips", () => {
  const store = new AqwasStore()
  store.set("x", 1)
  store.set("y", 2)

  const snapshot = store.encodeStateAsUpdate()

  const fresh = new AqwasStore()
  fresh.applyRemoteUpdate(snapshot)

  assertEquals(fresh.getAll(), { x: 1, y: 2 })

  store.destroy()
  fresh.destroy()
})
