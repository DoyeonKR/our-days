export type DraftEnvelope<T> = { version: 1; savedAt: string; value: T };

export function draftStorageKey(kind: "event" | "diary" | "question", scope = "new"): string {
  return `ourdays:draft:${kind}:${scope}`;
}

export function loadDraft<T>(storage: Pick<Storage, "getItem">, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as DraftEnvelope<T>) : null;
    return parsed?.version === 1 ? parsed.value : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(storage: Pick<Storage, "setItem">, key: string, value: T): boolean {
  try {
    const envelope: DraftEnvelope<T> = {
      version: 1,
      savedAt: new Date().toISOString(),
      value,
    };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: Pick<Storage, "removeItem">, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* noop */
  }
}
