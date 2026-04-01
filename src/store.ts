import * as Y from "yjs"

type ObserveCallback = (key: string, value: unknown, oldValue: unknown) => void

const MAP_NAME = "state"

export class AqwasStore {
  readonly doc: Y.Doc
  private map: Y.Map<unknown>
  private observers = new Set<ObserveCallback>()

  constructor() {
    this.doc = new Y.Doc()
    this.map = this.doc.getMap(MAP_NAME)

    this.map.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        const value = this.map.get(key)
        const oldValue = change.oldValue
        for (const cb of this.observers) {
          cb(key, value, oldValue)
        }
      })
    })
  }

  // Apply a Yjs update received from the server.
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, "remote")
  }

  // Apply a local state change. Returns the binary update for sending/buffering.
  applyLocalTransaction(fn: (map: Y.Map<unknown>) => void): Uint8Array {
    let update: Uint8Array = new Uint8Array()
    const handler = (u: Uint8Array, origin: unknown) => {
      if (origin !== "remote") update = u
    }
    this.doc.on("update", handler)
    this.doc.transact(() => fn(this.map), "local")
    this.doc.off("update", handler)
    return update
  }

  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.map.get(key) as T | undefined
  }

  set(key: string, value: unknown): Uint8Array {
    return this.applyLocalTransaction((map) => map.set(key, value))
  }

  delete(key: string): Uint8Array {
    return this.applyLocalTransaction((map) => map.delete(key))
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.map.entries())
  }

  onObserve(cb: ObserveCallback): () => void {
    this.observers.add(cb)
    return () => this.observers.delete(cb)
  }

  destroy(): void {
    this.observers.clear()
    this.doc.destroy()
  }
}
