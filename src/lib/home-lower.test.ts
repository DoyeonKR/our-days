import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
test("lower-home redesign replaces internal card surfaces, not only an outer wrapper",()=>{
  const log=read("../components/TodayLogCard.tsx"),mood=read("../components/MoodLine.tsx"),question=read("../components/DailyQuestion.tsx");
  assert.match(log,/<HomeLogFrame slot=\{slotLabel\(slot\)\}/);
  assert.match(log,/onCapture=\{\(\)=>onOpen\(true\)\}/);
  assert.match(mood,/<HomeMoodFrame/);
  assert.match(mood,/home-mood-choice/);
  assert.match(mood,/aria-pressed=\{isMine\}/);
  assert.match(question,/<HomeQuestionFrame question=\{q.text\}/);
  assert.match(question,/home-letter-input/);
  for(const code of [log,mood,question]) assert.ok(!/className="(?:glass relative mt-3|mt-3 rounded-\[var\(--radius-card\)\]|cosmic-feed-card animate-rise)/.test(code));
});
test("lower-home ends with functional plan and archive destinations; absent memories stay absent",()=>{
  const page=read("../app/page.tsx"),memory=read("../components/MemoryTeaser.tsx");
  assert.match(page,/<HomeNextPlan event=\{nextMs \|\| null\}/);
  assert.match(page,/<HomeJournalEnd onOpen=\{\(\) => goRecords\(coupleId \? "memories" : "photos"\)\}/);
  assert.match(memory,/home-memory-rewind/);
  assert.match(memory,/if \(!found\) return null/);
  assert.ok(page.indexOf("<TodayTogether")<page.indexOf("<HomeNextPlan"));
  assert.ok(page.indexOf("<HomeNextPlan")<page.indexOf("<HomeJournalEnd"));
});
