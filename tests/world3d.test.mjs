import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  genesis,
  view,
  sponsorSandbox,
  tick,
} from "../packages/simulation-core/index.mjs";
import {
  worldPositions,
  recordedDeliveries,
} from "../apps/web/src/world3d-layout.mjs";

test("3D residents and businesses retain deterministic world identities and locations", () => {
  const world = genesis();
  sponsorSandbox(world, "person_199", 100000, "world3d-test");
  for (let i = 0; i < 5; i++) tick(world);
  const w = view(world),
    a = worldPositions(w),
    b = worldPositions(w);
  assert.deepEqual(a, b);
  for (const e of w.entities.filter((e) =>
    ["PERSON", "BUSINESS"].includes(e.type),
  )) {
    const p = a.get(e.id);
    assert.ok(p, e.id);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  }
  const holding = w.holdings.find((h) => h.owner === "person_199");
  assert.ok(holding);
  const bakery = a.get(holding.entity),
    mira = a.get("person_199");
  assert.ok(Math.hypot(mira.x - bakery.x, mira.z - bakery.z) < 6);
  const places = w.entities
    .filter((e) => e.type === "BUSINESS")
    .map((e) => a.get(e.id));
  assert.equal(new Set(places.map((p) => `${p.x}:${p.z}`)).size, places.length);
});

test("3D goods trails can only come from purchases in the recorded current cycle", () => {
  const positions = new Map([
    ["seller", { x: 1, z: 2 }],
    ["buyer", { x: 4, z: 5 }],
  ]);
  const actual = {
    id: "purchase",
    cycle: 9,
    reason: "Purchase FLOUR",
    debit: "buyer",
    credit: "seller",
  };
  const w = {
    cycle: 9,
    ledger: [
      actual,
      { ...actual, id: "old", cycle: 8 },
      { ...actual, id: "salary", reason: "Wage" },
      { ...actual, id: "missing-place", credit: "elsewhere" },
    ],
  };
  assert.deepEqual(recordedDeliveries(w, positions), [actual]);
});

test("external 3D assets ship locally with license, pinned provenance and valid GLB headers", async () => {
  const root = new URL("../apps/web/public/models/kenney/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.license, "CC0-1.0");
  assert.match(manifest.revision, /^[a-f0-9]{40}$/);
  assert.ok(manifest.assets.length >= 15);
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.file, root));
    assert.equal(bytes.toString("ascii", 0, 4), "glTF");
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.length, asset.bytes);
    assert.ok(asset.source.includes(manifest.revision));
  }
  assert.match(await readFile(new URL("LICENSE.txt", root), "utf8"), /CC0/);
});

test("original Blender premises have reproducible source and valid self-contained GLB exports", async () => {
  const root = new URL("../apps/web/public/models/econia/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.author, "Econia");
  assert.equal(manifest.license, "CC0-1.0");
  assert.deepEqual(manifest.assets.map((a) => a.file).sort(), [
    "bakery.glb",
    "farm.glb",
    "harbor.glb",
    "mill.glb",
  ]);
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.file, root));
    assert.equal(bytes.toString("ascii", 0, 4), "glTF");
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.length, asset.bytes);
    const length = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.toString("utf8", 20, 20 + length));
    assert.ok(json.meshes.length > 10);
    assert.ok(json.buffers.every((b) => !b.uri));
    assert.ok((json.images || []).every((i) => !i.uri));
    assert.ok(
      (
        await readFile(new URL(`../${asset.source}`, import.meta.url), "utf8")
      ).includes("bpy.ops.export_scene.gltf"),
    );
  }
});

test("Higgsfield pavilion has a pinned reviewed revision and local mesh export", async () => {
  const root = new URL(
    "../apps/web/public/models/higgsfield/",
    import.meta.url,
  );
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.revision, 2);
  assert.match(manifest.tool, /Higgsfield/);
  const bytes = await readFile(new URL(manifest.file, root));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(8), manifest.bytes);
  assert.ok(
    (
      await readFile(
        new URL("../assets/higgsfield/pavilion-details.py", import.meta.url),
        "utf8",
      )
    ).includes("COMMONS"),
  );
});
