import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeSharedAppearance,parseAppearanceRecord,acceptAppearanceRecord,DEFAULT_SHARED_APPEARANCE} from "./coupleAppearance.ts";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8").replace(/\r\n/g,"\n");
test("shared presentation is whitelisted; device/auth/draft state is never synced",()=>{
 assert.deepEqual(normalizeSharedAppearance(null),DEFAULT_SHARED_APPEARANCE);
 const out=normalizeSharedAppearance({home:{greeting:"우리만의 문구"},theme:"mint",pixelArt:false,token:"secret",camera:true,draft:"private"});
 assert.equal(out.home.greeting,"우리만의 문구");assert.equal(out.theme,"mint");assert.equal(out.pixelArt,false);
 assert.deepEqual(Object.keys(out).sort(),["home","pixelArt","theme"]);
 assert.equal(normalizeSharedAppearance({theme:"invalid",pixelArt:"false"}).theme,"rose");
});
test("newer saves cannot be rolled back by delayed reads",()=>{
 const old=parseAppearanceRecord(null,0),next=parseAppearanceRecord({theme:"blue"},3);
 assert.equal(acceptAppearanceRecord(next,old),next);assert.equal(acceptAppearanceRecord(old,next),next);
 for(const version of [undefined,NaN,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>parseAppearanceRecord({},version));
});
test("linked mode uses server writes, bounded reconnect recovery and no automatic local overwrite",()=>{
 const provider=read("../components/SharedAppearanceProvider.tsx"),api=read("./couple.ts"),editor=read("../components/HomeAppearanceEditor.tsx");
 assert.match(provider,/services.subscribe\(coupleId/);assert.match(provider,/setInterval\(foreground,30000\)/);
 for(const event of ["online","focus","visibilitychange"])assert.ok(provider.includes(`addEventListener("${event}"`)&&provider.includes(`removeEventListener("${event}"`));
 assert.match(provider,/if\(coupleId\)adopt\(await services.save/);
 assert.match(api,/error.code==="PT409"/);assert.match(api,/if\(!sb\)throw Error\("공유 설정 서버/);
 assert.match(editor,/예전 문구 가져오기/);assert.match(editor,/saving.current=true/);
});
test("additive migration matches bootstrap and has membership, validation and CAS guards",()=>{
 const migration=read("../../supabase/migrations/20261018000000_shared_appearance.sql").trim(),bootstrap=read("../../supabase/schema.sql");
 assert.ok(bootstrap.includes(migration));assert.doesNotMatch(migration,/\b(drop table|delete from|truncate)\b/i);
 assert.match(migration,/for update/);assert.match(migration,/p_version is distinct from v_version/);assert.match(migration,/sqlstate 'PT409'/);
 assert.match(migration,/user_id = \(select auth.uid\(\)\)/);
 assert.match(migration,/from public, anon/);assert.match(migration,/to authenticated/);
 assert.doesNotMatch(migration,/grant\s+update/i);
});
