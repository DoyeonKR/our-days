import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmPokeSend,
  mergePokeInsert,
  reconcilePokeSnapshot,
  type PokeLike,
} from "./pokesync.ts";

const row = (id: string, message: string): PokeLike => ({
  id,
  from_user: "me",
  kind: "custom",
  message,
});

test("재연결 스냅샷은 서버 행을 정본으로 쓰되 아직 미확정 tmp는 보존한다", () => {
  assert.deepEqual(
    reconcilePokeSnapshot([row("server-2", "둘"), row("server-1", "하나")], [
      row("tmp-3", "셋"),
      row("old", "오래됨"),
    ]).map((x) => x.id),
    ["tmp-3", "server-2", "server-1"],
  );
});

test("서버에 같은 전송이 생겼으면 대응하는 tmp 한 개만 제거한다", () => {
  assert.deepEqual(
    reconcilePokeSnapshot([row("server-1", "같은 말")], [
      row("tmp-2", "같은 말"),
      row("tmp-1", "같은 말"),
    ]).map((x) => x.id),
    ["tmp-1", "server-1"],
  );
});

test("스냅샷 자체의 중복 id와 상한을 방어한다", () => {
  assert.deepEqual(
    reconcilePokeSnapshot(
      [row("a", "A"), row("a", "A"), row("b", "B")],
      [],
      2,
    ).map((x) => x.id),
    ["a", "b"],
  );
});

test("같은 문구를 연속 전송해도 실시간 echo 한 건은 tmp 한 개만 제거한다", () => {
  assert.deepEqual(
    mergePokeInsert(row("server-1", "같은 말"), [
      row("tmp-2", "같은 말"),
      row("tmp-1", "같은 말"),
    ]).map((x) => x.id),
    ["server-1", "tmp-1"],
  );
});

test("echo가 먼저 tmp를 치웠어도 API 응답의 저장 행을 잃지 않는다", () => {
  assert.deepEqual(
    confirmPokeSend([row("server-1", "같은 말")], "tmp-2", row("server-2", "같은 말")).map(
      (x) => x.id,
    ),
    ["server-2", "server-1"],
  );
});
