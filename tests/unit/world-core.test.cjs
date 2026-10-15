const test = require('node:test');
const assert = require('node:assert/strict');
let world;
test.before(async () => { world = await import('../../js/world/world-core.mjs'); });
test('world spawn is navigable', () => assert.equal(world.canOccupy(world.SPAWN.x,world.SPAWN.z), true));
test('world boundary excludes outside coordinates', () => {
  assert.equal(world.canOccupy(50,0),false);
  assert.equal(world.canOccupy(NaN,0),false);
});
test('movement advances deterministically and normalizes diagonals', () => {
  const next=world.advance({x:0,z:0},{x:1,z:1},10,0.1,[]);
  assert.ok(Math.abs(next.x - Math.SQRT1_2)<1e-9);
  assert.ok(Math.abs(next.z - Math.SQRT1_2)<1e-9);
});
test('movement slides along obstacle axis rather than crossing', () => {
  const obstacle=[{minX:1,maxX:4,minZ:-2,maxZ:2}];
  const next=world.advance({x:0,z:0},{x:1,z:1},10,0.1,obstacle);
  assert.equal(next.x,0);
  assert.ok(next.z>0);
});
test('world rejects impossible time and speed', () => {
  assert.throws(()=>world.advance({x:0,z:0},{x:1,z:0},5,NaN),RangeError);
  assert.throws(()=>world.advance({x:0,z:0},{x:1,z:0},-2,0.05),RangeError);
});
test('interaction selects nearest eligible target', () => {
  assert.equal(world.closestInteraction({x:-11,z:13}).id,'trainer');
  assert.equal(world.closestInteraction({x:45,z:45}),null);
});
