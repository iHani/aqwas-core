import * as Y from "yjs";

type ObserveCallback = (key: string, value: unknown, oldValue: unknown) => void;

const MAP_NAME = "state";

export class AqwasStore {
  readonly doc: Y.Doc;
  private map: Y.Map<unknown>;
  private observers = new Set<ObserveCallback>();
  private lastSnapshot: Uint8Array | null = null;

  constructor() {
    this.doc = new Y.Doc();
    this.map = this.doc.getMap(MAP_NAME);

    this.map.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        const value = this.map.get(key);
        const oldValue = change.oldValue;
        for (const cb of this.observers) {
          cb(key, value, oldValue);
        }
      });
    });
  }

  // Apply a Yjs update received from the server.
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, "remote");
  }

  // Apply a local state change. Returns the binary update for sending/buffering.
  applyLocalTransaction(fn: (map: Y.Map<unknown>) => void): Uint8Array {
    this.lastSnapshot = Y.encodeStateAsUpdate(this.doc);
    let update: Uint8Array = new Uint8Array();
    const handler = (u: Uint8Array, origin: unknown) => {
      if (origin !== "remote") update = u;
    };
    this.doc.on("update", handler);
    this.doc.transact(() => fn(this.map), "local");
    this.doc.off("update", handler);
    return update;
  }

  // Revert the last local transaction by restoring the pre-mutation snapshot.
  rollback(): void {
    if (!this.lastSnapshot) return;
    const snapshot = this.lastSnapshot;
    this.lastSnapshot = null;
    // Rebuild the doc state from the snapshot
    const fresh = new Y.Doc();
    Y.applyUpdate(fresh, snapshot);
    const freshMap = fresh.getMap(MAP_NAME);
    // Apply snapshot as a remote update so observers fire for reverted keys
    this.doc.transact(() => {
      // Clear keys that are in current map but not in snapshot
      for (const key of this.map.keys()) {
        if (!freshMap.has(key)) this.map.delete(key);
      }
      // Restore values from snapshot
      freshMap.forEach((value, key) => {
        this.map.set(key, value);
      });
    }, "remote");
    fresh.destroy();
  }

  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.map.get(key) as T | undefined;
  }

  set(key: string, value: unknown): Uint8Array {
    return this.applyLocalTransaction((map) => map.set(key, value));
  }

  delete(key: string): Uint8Array {
    return this.applyLocalTransaction((map) => map.delete(key));
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.map.entries());
  }

  onObserve(cb: ObserveCallback): () => void {
    this.observers.add(cb);
    return () => this.observers.delete(cb);
  }

  destroy(): void {
    this.observers.clear();
    this.doc.destroy();
  }
}
