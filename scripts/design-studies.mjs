import { writeFileSync } from "node:fs";
const themes = [
  {
    name: "Harbor commons",
    note: "Warm civic overlays, sage streets, coastal light. Selected for continuity with the existing original assets.",
    sky: "#b0d0d0",
    ground: "#d2d7b0",
    wall: "#e8d9b5",
    roof: "#677d71",
    ink: "#284a3b",
  },
  {
    name: "Garden ateliers",
    note: "Quiet orchard neighborhoods, pale clay and deep green. Strong alternative for a smaller garden city.",
    sky: "#d9e2ce",
    ground: "#c5d2a7",
    wall: "#e4c8b8",
    roof: "#735e4f",
    ink: "#395544",
  },
  {
    name: "Foundry town",
    note: "Restrained brick, paper and slate. A more urban direction for technical and creative studios.",
    sky: "#d1d9d9",
    ground: "#d5cbb5",
    wall: "#bf8c73",
    roof: "#52616b",
    ink: "#354447",
  },
];
function scene(t) {
  let buildings = "";
  for (const [i, [x, y]] of [
    [160, 128],
    [260, 170],
    [360, 212],
    [260, 80],
    [360, 122],
    [460, 164],
  ].entries()) {
    buildings += `<g transform="translate(${x} ${y})"><path d="M0 0L62 34L0 70L-62 34Z" fill="${t.roof}"/><path d="M-62 34L0 70V120L-62 84Z" fill="${t.wall}"/><path d="M0 70L62 34V84L0 120Z" fill="${i % 2 ? "#c5c5b2" : t.wall}"/><rect x="-42" y="60" width="16" height="24" fill="${t.ink}"/><path d="M16 81L36 70V92L16 104Z" fill="#f8efcc"/></g>`;
  }
  return `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="400" fill="${t.sky}"/><path d="M20 218L320 45L620 218L320 392Z" fill="${t.ground}"/><path d="M110 166L410 339M215 105L515 278" stroke="#f5efdc" stroke-width="22"/>${buildings}<g transform="translate(325 280)"><circle cy="-18" r="7" fill="${t.ink}"/><path d="M-8-8H8L11 18H-11Z" fill="#faf4dc"/></g><rect x="22" y="20" width="148" height="40" rx="10" fill="#fcf8ef"/><text x="40" y="46" fill="${t.ink}" font-family="system-ui" font-size="14" letter-spacing="3">◈ ECONIA</text><rect x="145" y="343" width="350" height="38" rx="12" fill="#fcf8ef"/><text x="162" y="367" fill="${t.ink}" font-family="system-ui" font-size="12">Explore　 Discover　 My Agents　 Activity　 Messages</text></svg>`;
}
writeFileSync(
  "apps/web/public/design-studies.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Econia — Three world directions</title><style>body{margin:0;padding:48px;background:#f5f1e7;color:#29463b;font:16px/1.6 system-ui}h1{font:44px Georgia}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}article{background:#fffcf5;border:1px solid #dcd8cc;border-radius:16px;overflow:hidden}article div{padding:24px}h2{font:27px Georgia;margin:0}p{max-width:80ch}svg{display:block;width:100%}small{letter-spacing:2px}a{color:inherit}</style><small>ECONIA 2.0 • VISUAL EXPLORATIONS</small><h1>One society. Three coherent directions.</h1><p>Art-direction concepts only. These drawings do not claim live agents, contracts or completed work. All use the same isometric camera, scale, architecture and restrained contextual navigation.</p><main>${themes.map((t) => `<article>${scene(t)}<div><h2>${t.name}</h2><p>${t.note}</p></div></article>`).join("")}</main><p>Selected: Harbor commons. Reuse the cohesive coastal geometry and original Blender assets; remove all persistent metric panels. Professional state must come from the runtime.</p><a href="/">Open the evolving world ↗</a></html>`,
);
