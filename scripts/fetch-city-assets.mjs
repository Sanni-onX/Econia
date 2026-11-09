import { mkdir, writeFile } from "node:fs/promises";
const repository = "Hidencod/tge-assets";
const revision = process.argv[2] || "ea2f2aa1ca8da0898330c97df8a5489976b051d0";
if (!revision) throw Error("Missing asset revision");
const groups = {
  "city-kit-suburban": [
    "building-type-a",
    "building-type-c",
    "building-type-f",
    "building-type-h",
    "building-type-l",
    "building-type-q",
  ],
  "city-kit-commercial": [
    "building-a",
    "building-c",
    "building-d",
    "building-f",
    "detail-parasol-a",
  ],
  "nature-kit": [
    "tree-oak",
    "tree-pinedefaulta",
    "tree-detailed",
    "plant-bush",
    "rock-largea",
    "flower-yellowa",
  ],
  "car-kit": ["truck", "van"],
  "mini-characters": ["character-female-a", "character-male-a"],
};
const root = "apps/web/public/models/kenney";
await mkdir(root, { recursive: true });
const manifest = [];
for (const [pack, names] of Object.entries(groups))
  for (const name of names) {
    const path = `packs/${pack}/${name}.glb`,
      url = `https://raw.githubusercontent.com/${repository}/${revision}/${path}`;
    const r = await fetch(url);
    if (!r.ok) throw Error(`${r.status} ${path}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.toString("ascii", 0, 4) !== "glTF")
      throw Error(`Invalid GLB ${path}`);
    const file = `${pack}--${name}.glb`;
    await writeFile(`${root}/${file}`, bytes);
    manifest.push({ file, source: url, bytes: bytes.length });
  }
await writeFile(
  `${root}/manifest.json`,
  JSON.stringify(
    {
      author: "Kenney",
      license: "CC0-1.0",
      repository,
      revision,
      assets: manifest,
    },
    null,
    2,
  ),
);
const license = await (
  await fetch(
    `https://raw.githubusercontent.com/${repository}/${revision}/LICENSE`,
  )
).text();
await writeFile(`${root}/LICENSE.txt`, license);
console.log(
  JSON.stringify({
    models: manifest.length,
    bytes: manifest.reduce((n, x) => n + x.bytes, 0),
    revision,
  }),
);
