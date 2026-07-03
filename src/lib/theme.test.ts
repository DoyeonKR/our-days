// theme.ts 회귀 lock — window/document/localStorage 전역을 런타임에 참조하므로 모킹.
// SSR 안전성(전역 없음)과 localStorage 예외 시 폴백을 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getTheme, applyTheme, setTheme, THEME_KEY } from "./theme.ts";

type MockStore = { data: Record<string, string>; throwOnGet?: boolean; throwOnSet?: boolean };
type Attrs = Record<string, string | null>;

const g = globalThis as unknown as {
  window?: object;
  localStorage?: {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
    removeItem(k: string): void;
  };
  document?: { documentElement: { setAttribute(k: string, v: string): void; removeAttribute(k: string): void } };
};

function install(store: MockStore): Attrs {
  const attrs: Attrs = {};
  g.window = {};
  g.localStorage = {
    getItem(k) {
      if (store.throwOnGet) throw new Error("blocked");
      return store.data[k] ?? null;
    },
    setItem(k, v) {
      if (store.throwOnSet) throw new Error("blocked");
      store.data[k] = v;
    },
    removeItem(k) {
      delete store.data[k];
    },
  };
  g.document = {
    documentElement: {
      setAttribute(k, v) {
        attrs[k] = v;
      },
      removeAttribute(k) {
        attrs[k] = null;
      },
    },
  };
  return attrs;
}

function uninstall() {
  delete g.window;
  delete g.localStorage;
  delete g.document;
}

test("getTheme: SSR(전역 없음)이면 rose", () => {
  uninstall();
  assert.equal(getTheme(), "rose");
});

test("getTheme: 저장된 유효 테마를 반환", () => {
  try {
    install({ data: { [THEME_KEY]: "blue" } });
    assert.equal(getTheme(), "blue");
  } finally {
    uninstall();
  }
});

test("getTheme: 잘못된 값/없음은 rose 폴백", () => {
  try {
    install({ data: { [THEME_KEY]: "not-a-theme" } });
    assert.equal(getTheme(), "rose");
    install({ data: {} });
    assert.equal(getTheme(), "rose");
  } finally {
    uninstall();
  }
});

test("getTheme: localStorage.getItem 예외 시 rose 폴백(throw 안 함)", () => {
  try {
    install({ data: {}, throwOnGet: true });
    assert.equal(getTheme(), "rose");
  } finally {
    uninstall();
  }
});

test("applyTheme: rose 는 data-theme 제거, 그 외는 설정", () => {
  try {
    const attrs = install({ data: {} });
    applyTheme("blue");
    assert.equal(attrs["data-theme"], "blue");
    applyTheme("rose");
    assert.equal(attrs["data-theme"], null);
  } finally {
    uninstall();
  }
});

test("applyTheme: document 없으면 조용히 반환(throw 안 함)", () => {
  uninstall();
  assert.doesNotThrow(() => applyTheme("purple"));
});

test("setTheme: 적용 + 저장, setItem 예외에도 throw 안 함", () => {
  try {
    const store: MockStore = { data: {} };
    const attrs = install(store);
    setTheme("mint");
    assert.equal(attrs["data-theme"], "mint");
    assert.equal(store.data[THEME_KEY], "mint");
    store.throwOnSet = true;
    assert.doesNotThrow(() => setTheme("lime"));
    assert.equal(attrs["data-theme"], "lime"); // 적용은 됨
  } finally {
    uninstall();
  }
});
