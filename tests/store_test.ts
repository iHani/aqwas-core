import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { AqwasStore } from "../src/store.ts";

Deno.test("Store: get/set/delete basic ops", () => {
  const store = new AqwasStore();

  store.set("score", 100);
  assertEquals(store.get("score"), 100);

  store.set("name", "Alice");
  assertEquals(store.get("name"), "Alice");

  store.delete("score");
  assertEquals(store.get("score"), undefined);

  store.destroy();
});

Deno.test("Store: getAll returns plain object", () => {
  const store = new AqwasStore();
  store.set("a", 1);
  store.set("b", "hello");

  const all = store.getAll();
  assertEquals(all, { a: 1, b: "hello" });

  store.destroy();
});

Deno.test("Store: applyRemoteSet merges into state", () => {
  const store = new AqwasStore();
  store.applyRemoteSet("x", 42);
  assertEquals(store.get("x"), 42);
  store.destroy();
});

Deno.test("Store: applyRemoteDelete removes key", () => {
  const store = new AqwasStore();
  store.set("x", 42);
  store.applyRemoteDelete("x");
  assertEquals(store.get("x"), undefined);
  store.destroy();
});

Deno.test("Store: applySync replaces full state and fires observers", () => {
  const store = new AqwasStore();
  store.set("old", 1);

  const changes: Array<{ key: string; value: unknown; oldValue: unknown }> = [];
  store.onObserve((key, value, oldValue) =>
    changes.push({ key, value, oldValue })
  );

  store.applySync({ a: 10, b: 20 });

  assertEquals(store.get("a"), 10);
  assertEquals(store.get("b"), 20);
  assertEquals(store.get("old"), undefined);

  // Observer fired for changed keys
  const keys = changes.map((c) => c.key).sort();
  assertEquals(keys, ["a", "b", "old"]);

  store.destroy();
});

Deno.test("Store: LWW — last applyRemoteSet wins", () => {
  const store = new AqwasStore();
  store.applyRemoteSet("key", "first");
  store.applyRemoteSet("key", "second");
  assertEquals(store.get("key"), "second");
  store.destroy();
});

Deno.test("Store: onObserve fires on local set", () => {
  const store = new AqwasStore();
  const events: Array<{ key: string; value: unknown }> = [];

  store.onObserve((key, value) => events.push({ key, value }));
  store.set("score", 99);

  assertEquals(events.length, 1);
  assertEquals(events[0], { key: "score", value: 99 });

  store.destroy();
});

Deno.test("Store: onObserve fires on applyRemoteSet", () => {
  const store = new AqwasStore();
  const events: Array<{ key: string; value: unknown }> = [];

  store.onObserve((key, value) => events.push({ key, value }));
  store.applyRemoteSet("msg", "hello");

  assertEquals(events.length, 1);
  assertEquals(events[0], { key: "msg", value: "hello" });

  store.destroy();
});

Deno.test("Store: onObserve unsubscribe stops callbacks", () => {
  const store = new AqwasStore();
  let count = 0;

  const unsub = store.onObserve(() => count++);
  store.set("a", 1);
  assertEquals(count, 1);

  unsub();
  store.set("b", 2);
  assertEquals(count, 1);

  store.destroy();
});

Deno.test("Store: getAll returns a copy (not live reference)", () => {
  const store = new AqwasStore();
  store.set("x", 1);
  store.set("y", 2);

  const snapshot = store.getAll();
  store.set("z", 3);

  assertEquals(snapshot, { x: 1, y: 2 });
  assertEquals(store.getAll(), { x: 1, y: 2, z: 3 });

  store.destroy();
});
