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

test("재연결 스냅샷은 합집합 — 미확정 tmp 와 스냅샷 밖 실 id 행을 모두 보존한다", () => {
  // 2026-08-26 의미 교정: pokes 는 삽입 전용이라 '스냅샷에 없는 실 id 행'은 오래된 게
  // 아니라 **스냅샷 SELECT 이후 확정된 새 행**이다(재연결 공백의 realtime 선착 등).
  // 통째 교체는 방금 알림까지 뜬 쿡을 지웠다.
  assert.deepEqual(
    reconcilePokeSnapshot([row("server-2", "둘"), row("server-1", "하나")], [
      row("tmp-3", "셋"),
      row("fresh", "스냅샷 이후 확정"),
    ]).map((x) => x.id),
    ["tmp-3", "fresh", "server-2", "server-1"],
  );
});

test("★ 스냅샷 왕복 중 realtime 으로 먼저 들어온 실 id 행이 사라지지 않는다 [리뷰 2026-08-26]", () => {
  // 재연결 resync: recentPokes 조회가 도는 사이 상대의 새 쿡이 INSERT 로 먼저 화면에
  // 반영된 경우 — 스냅샷이 늦게 도착해도 그 행을 지우면 안 된다.
  const out = reconcilePokeSnapshot(
    [row("server-1", "하나")],
    [row("server-9", "방금 도착"), row("server-1", "하나")],
  ).map((x) => x.id);
  assert.ok(out.includes("server-9"), "스냅샷 밖 실 id 행이 제거됐다");
  assert.equal(out.filter((id) => id === "server-1").length, 1, "중복 없이 한 번만");
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
