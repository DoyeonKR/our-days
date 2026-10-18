import test from "node:test";
import assert from "node:assert/strict";
import { CRAFT_EXPANSIONS, PRODUCTS, createIsland, craftSlots, craftExpansionProgress, skillXpFor, hugPet, collectCraft, fulfillOrder, DAY_MS } from "./island.ts";

const T = Date.UTC(2026,9,18,3);
function state(level = 1, recipes = 0, orders = 0) {
  const s = createIsland("요리사", null, T);
  s.farm.skillXp = level === 1 ? 0 : skillXpFor(level);
  s.catalog.push(...PRODUCTS.slice(0,recipes).map(p=>`product_${p.key}`));
  s.orderCount = orders;
  return s;
}
test("legacy free worktops remain 1 / 2 / 3 at farming levels 1 / 8 / 14", () => {
  assert.equal(craftSlots(state()),1);
  assert.equal(craftSlots(state(8)),2);
  assert.equal(craftSlots(state(14)),3);
  assert.equal(craftSlots(state(20)),3);
});
test("extra worktops require every published condition, including exact boundary values", () => {
  assert.equal(craftSlots(state(14,5)),3);
  assert.equal(craftSlots(state(14,6)),4);
  assert.equal(craftSlots(state(13,6)),2);
  assert.equal(craftSlots(state(18,10,14)),4);
  assert.equal(craftSlots(state(18,10,15)),5);
  assert.equal(craftSlots(state(20,18,49)),5);
  assert.equal(craftSlots(state(20,18,50)),6);
  assert.ok(CRAFT_EXPANSIONS.every(x=>x.skill <= 20));
});
test("duplicate and unknown discoveries cannot fake a recipe unlock; legacy orderCount is optional", () => {
  const s = state(20);
  delete s.orderCount;
  s.catalog.push(...Array(50).fill(`product_${PRODUCTS[0].key}`),"product_unknown","pet_cat");
  assert.equal(craftSlots(s),3);
  assert.equal(craftExpansionProgress(s)[0].checks[1].have,1);
});
test("padding new slots never mutates input, deletes cooking meals, or charges hearts", () => {
  const s = state(20,18,50);
  s.farm.craft[0]={product:PRODUCTS[0].key,startAt:T,star:3};
  const snapshot=JSON.stringify(s);
  const next=hugPet(s,T);
  assert.equal(JSON.stringify(s),snapshot);
  assert.equal(next.farm.craft.length,6);
  assert.deepEqual(next.farm.craft[0],s.farm.craft[0]);
  assert.equal(next.coins,s.coins);
});
test("discovering the sixth meal unlocks its worktop in that same successful collection", () => {
  const s=state(14,5);
  s.farm.craft[0]={product:PRODUCTS[5].key,startAt:T - 100*DAY_MS,star:3};
  const next=collectCraft(s,0,T,"store");
  assert.equal(next.farm.craft.length,4);
  assert.ok(next.catalog.includes(`product_${PRODUCTS[5].key}`));
  assert.equal(s.farm.craft.length,1);
});
test("finishing the 50th order opens the sixth worktop immediately and only once", () => {
  const s=state(20,18,49);
  s.farm.barn.carrot={qty:2,star:3};
  s.orders={day:"2026-10-18",list:[{id:"qa-order",npc:"baker",items:[{key:"carrot",qty:1,star:1}],coins:10,xp:1,bond:0,done:false}]};
  const next=fulfillOrder(s,"qa-order",T);
  assert.equal(next.orderCount,50);
  assert.equal(next.farm.craft.length,6);
  assert.equal(fulfillOrder(next,"qa-order",T),next);
  assert.equal(s.orderCount,49);
});
