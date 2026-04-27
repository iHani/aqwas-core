type ObserveCallback = (key: string, value: unknown, oldValue: unknown) => void;

export class AqwasStore {
  private state: Record<string, unknown> = {};
  private observers = new Set<ObserveCallback>();

  applyRemoteSet(key: string, value: unknown): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    for (const cb of this.observers) cb(key, value, oldValue);
  }

  applyRemoteDelete(key: string): void {
    const oldValue = this.state[key];
    delete this.state[key];
    for (const cb of this.observers) cb(key, undefined, oldValue);
  }

  applySync(incoming: Record<string, unknown>): void {
    const allKeys = new Set([
      ...Object.keys(this.state),
      ...Object.keys(incoming),
    ]);
    const next = { ...incoming };
    for (const key of allKeys) {
      const oldValue = this.state[key];
      const newValue = incoming[key];
      if (oldValue !== newValue) {
        for (const cb of this.observers) cb(key, newValue, oldValue);
      }
    }
    this.state = next;
  }

  get<T = unknown>(key: string): T | undefined {
    return this.state[key] as T | undefined;
  }

  set(key: string, value: unknown): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    for (const cb of this.observers) cb(key, value, oldValue);
  }

  delete(key: string): void {
    const oldValue = this.state[key];
    delete this.state[key];
    for (const cb of this.observers) cb(key, undefined, oldValue);
  }

  getAll(): Record<string, unknown> {
    return { ...this.state };
  }

  onObserve(cb: ObserveCallback): () => void {
    this.observers.add(cb);
    return () => this.observers.delete(cb);
  }

  destroy(): void {
    this.observers.clear();
  }
}
