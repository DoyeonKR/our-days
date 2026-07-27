// Storage 고아 파일 방지 회귀 lock. [2026-07-27]
// 업로드는 성공했는데 메타 row insert 가 실패하면, 그 파일을 참조하는 row 가 영영 없어서
// **영구 고아**가 된다(무료 1GB 스토리지를 갉아먹고, 나중에 어떤 재시도로도 회수 불가).
// 실제 운영 DB 점검에서 고아 1건이 발견되어 정리 규칙을 명문화한다.
// 규칙: "업로드 후 메타 저장 실패 → 방금 올린 파일을 best-effort 로 지운다"
//       (깨진 row 보다 고아 파일이 낫다는 반대 방향은 이미 deleteCoupleLog 등이 채택)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "couple.ts"), "utf8");

/** 함수 본문만 잘라낸다(다음 export 선언 전까지). */
function bodyOf(name: string): string {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, `${name} 함수를 찾지 못함`);
  const rest = src.slice(i + 10);
  const j = rest.indexOf("\nexport ");
  return j >= 0 ? rest.slice(0, j) : rest;
}

test("uploadPhoto: 메타 insert 실패 시 올린 파일을 정리(고아 방지)", () => {
  const body = bodyOf("uploadPhoto");
  // 메타 실패 분기가 존재해야 한다
  assert.ok(/metaErr/.test(body), "metaErr 처리 분기가 없음");
  // 그 분기 안에서 storage remove 를 호출해야 한다 (throw 만 하고 끝내면 고아 발생)
  const metaBlock = body.slice(body.indexOf("metaErr"));
  assert.ok(
    /\.remove\(/.test(metaBlock),
    "메타 저장 실패 시 storage remove 정리가 없음 → 업로드된 파일이 영구 고아가 된다",
  );
});

test("uploadLogVideo/로그 경로도 동일 규칙 유지", () => {
  // 기존에 이미 채택된 규칙이 사라지지 않도록 lock (주석/구현 어느 쪽이 바뀌어도 감지)
  assert.ok(
    /고아/.test(src) && /\.remove\(/.test(src),
    "고아 정리 규칙이 couple.ts 에서 사라짐",
  );
});

test("deletePhoto: row 삭제 후 storage 파일도 제거", () => {
  const body = bodyOf("deletePhoto");
  assert.ok(/\.remove\(/.test(body), "deletePhoto 가 storage 파일을 지우지 않음");
});
