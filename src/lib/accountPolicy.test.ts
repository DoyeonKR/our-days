import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_EXPORT_TABLES,
  accountArchiveName,
  collectExportMediaPaths,
  ourDaysStorageKeys,
  safeExportMediaPath,
} from "./accountPolicy.ts";

test("계정 내보내기: 실제 사진·썸네일·일기 사진·로그 영상을 중복 없이 모은다", () => {
  assert.deepEqual(
    collectExportMediaPaths({
      couple_photos: [
        { storage_path: "c/a.webp", thumb_path: "c/a.thumb.webp" },
        { storage_path: "c/a.webp", thumb_path: null },
      ],
      deco_entries: [{ photo_paths: ["c/diary.webp", "c/a.webp"] }],
      couple_logs: [{ video_path: "c/log.webm" }, { video_path: null }],
    }),
    ["c/a.thumb.webp", "c/a.webp", "c/diary.webp", "c/log.webm"],
  );
});

test("계정 내보내기: ZIP 경로 탈출과 비정상 Storage 경로를 거부한다", () => {
  assert.equal(safeExportMediaPath("/couple/photo.webp"), "couple/photo.webp");
  for (const path of ["../secret", "couple/../../secret", "couple\\secret", "couple//photo"]) {
    assert.equal(safeExportMediaPath(path), null);
  }
  assert.deepEqual(
    collectExportMediaPaths({
      couple_photos: [{ storage_path: "couple/good.webp", thumb_path: "../bad.webp" }],
      deco_entries: [{ photo_paths: ["couple/./bad.webp", "couple/diary.webp"] }],
    }),
    ["couple/diary.webp", "couple/good.webp"],
  );
});

test("계정 내보내기: 현재 앱에서 쓰는 관계·기록·설정 테이블을 포함한다", () => {
  for (const name of [
    "couples",
    "couple_events",
    "couple_photos",
    "deco_entries",
    "couple_logs",
    "notify_prefs",
  ]) {
    assert.ok(ACCOUNT_EXPORT_TABLES.includes(name as (typeof ACCOUNT_EXPORT_TABLES)[number]));
  }
});

test("기기 초기화: ourdays 네임스페이스만 골라 다른 서비스 저장값은 보존한다", () => {
  assert.deepEqual(
    ourDaysStorageKeys(["ourdays:me", "theme", "sb-project-auth-token", "ourdays:draft:event"]),
    ["ourdays:me", "ourdays:draft:event"],
  );
  assert.equal(accountArchiveName(new Date("2026-08-25T01:00:00Z")), "our-days-export-2026-08-25");
});
