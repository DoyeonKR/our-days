// Isolated PostgreSQL verification only. Never connects to the production database.
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const db=new PGlite();
const migration=readFileSync(new URL("../supabase/migrations/20261018000000_shared_appearance.sql",import.meta.url),"utf8");
const a="00000000-0000-0000-0000-000000000001",b="00000000-0000-0000-0000-000000000002",other="00000000-0000-0000-0000-000000000003",couple="10000000-0000-0000-0000-000000000001";
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.couples(id uuid primary key,start_date date);
 create table public.couple_members(couple_id uuid,user_id uuid);
 insert into public.couples(id) values('${couple}');
 insert into public.couple_members values('${couple}','${a}'),('${couple}','${b}');
 grant usage on schema public,auth to anon,authenticated;
 grant select on public.couples,public.couple_members to authenticated;
 grant update(start_date) on public.couples to authenticated;
 alter table public.couples enable row level security;
 create policy read_members on public.couples for select to authenticated using (exists(select 1 from public.couple_members m where m.couple_id=id and m.user_id=(select auth.uid())));`);
 await db.exec(migration);
 const home={greeting:"둘이 함께",subtitle:null,story:"OUR STORY",dayLabel:"일째",font:"clean",align:"left",accent:"ink",showDays:true,showUnread:true,dayFormat:"days"};
 const settings={home,theme:"mint",pixelArt:false};
 const as=async(user,role="authenticated")=>{await db.exec(`reset role;set role ${role};`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);};
 const save=async(value,version)=> (await db.query("select public.save_couple_appearance($1,$2::jsonb,$3) as result",[couple,JSON.stringify(value),version])).rows[0].result;
 await as(a);const first=await save(settings,0);assert.equal(first.version,1);
 await as(b);const read=(await db.query("select shared_appearance from public.couples where id=$1",[couple])).rows[0].shared_appearance;assert.deepEqual(read,settings);
 const second=await save({...settings,home:{...home,greeting:"상대방이 바꾼 문구"}},1);assert.equal(second.version,2);
 await as(a);await assert.rejects(()=>save(settings,1),e=>e.code==="PT409");
 const stored=(await db.query("select shared_appearance,appearance_version from public.couples where id=$1",[couple])).rows[0];assert.equal(stored.appearance_version,2);assert.equal(stored.shared_appearance.home.greeting,"상대방이 바꾼 문구");
 for(const value of [null,{...settings,token:"forbidden"},{...settings,home:{...home,greeting:"가".repeat(41)}},{...settings,pixelArt:"false"},{...settings,home:{...home,showDays:"true"}},{...settings,theme:"custom"}])await assert.rejects(()=>save(value,2),e=>e.code==="22023");
 await assert.rejects(()=>db.query("update public.couples set appearance_version=999 where id=$1",[couple]),e=>e.code==="42501");
 await as(other);assert.equal((await db.query("select id from public.couples")).rows.length,0);await assert.rejects(()=>save(settings,2),e=>e.code==="42501");
 await as(a,"anon");await assert.rejects(()=>save(settings,2),e=>e.code==="42501");
 await as(a);const concurrent=await Promise.allSettled([save(settings,2),save({...settings,theme:"blue"},2)]);assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);assert.equal(concurrent.filter(x=>x.status==="rejected"&&x.reason.code==="PT409").length,1);
 await db.exec("reset role");await db.exec(migration);assert.equal((await db.query("select appearance_version from public.couples")).rows[0].appearance_version,3);
 console.log(JSON.stringify({passed:true,checks:["partner read/write","stale save rejected","invalid payload rejected","direct revision update forbidden","nonmember read/write denied","anon RPC denied","concurrent saves have exactly one winner","migration idempotent and data preserved"]}));
}finally{await db.close();}
