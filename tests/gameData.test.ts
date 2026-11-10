import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENTS } from '../src/data/agents';
import { MAPS } from '../src/data/maps';
import { WEAPONS } from '../src/data/weapons';

test('game catalogs contain the expected playable content', () => {
  assert.equal(AGENTS.length, 12);
  assert.equal(MAPS.length, 5);
  assert.ok(WEAPONS.length >= 20);
});

test('agent, map, and weapon identifiers are unique', () => {
  for (const [label, ids] of [
    ['agent', AGENTS.map(item => item.id)],
    ['map', MAPS.map(item => item.id)],
    ['weapon', WEAPONS.map(item => item.id)]
  ] as const) {
    assert.equal(new Set(ids).size, ids.length, `${label} identifiers must be unique`);
  }
});

test('agents reference valid agent ability identifiers and weapon values are usable', () => {
  for (const agent of AGENTS) {
    const abilities = [agent.passive, agent.ability1, agent.ability2, agent.ability3, agent.ultimate];
    assert.ok(abilities.every(ability => ability.id && ability.name));
    assert.equal(new Set(abilities.map(ability => ability.id)).size, abilities.length);
  }

  for (const weapon of WEAPONS) {
    assert.ok(weapon.magazineSize > 0, `${weapon.id} must have a positive magazine size`);
    assert.ok(weapon.fireRate > 0, `${weapon.id} must have a positive fire rate`);
    assert.ok(Number.isFinite(weapon.cost) && weapon.cost >= 0, `${weapon.id} must have a valid cost`);
  }
});

test('maps define finite objective locations and callouts', () => {
  for (const map of MAPS) {
    for (const point of [map.siteA, map.siteB, map.attackerSpawn, map.defenderSpawn]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z), `${map.id} has invalid coordinates`);
    }
    assert.ok(map.siteA.radius > 0 && map.siteB.radius > 0, `${map.id} has invalid site radii`);
    assert.ok(map.callouts.length > 0, `${map.id} must provide callouts`);
  }
});
