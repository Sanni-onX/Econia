import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import {
  worldDistricts,
  worldPositions,
  recordedDeliveries,
} from "./world3d-layout.mjs";

const ROOT = "/models/kenney/";
const assets = {
  econiaBakery: "/models/econia/bakery.glb",
  econiaFarm: "/models/econia/farm.glb",
  econiaMill: "/models/econia/mill.glb",
  econiaHarbor: "/models/econia/harbor.glb",
  homeA: "city-kit-suburban--building-type-a",
  homeC: "city-kit-suburban--building-type-c",
  homeF: "city-kit-suburban--building-type-f",
  homeH: "city-kit-suburban--building-type-h",
  homeL: "city-kit-suburban--building-type-l",
  homeQ: "city-kit-suburban--building-type-q",
  shopA: "city-kit-commercial--building-a",
  shopC: "city-kit-commercial--building-c",
  shopD: "city-kit-commercial--building-d",
  shopF: "city-kit-commercial--building-f",
  parasol: "city-kit-commercial--detail-parasol-a",
  oak: "nature-kit--tree-oak",
  pine: "nature-kit--tree-pinedefaulta",
  tree: "nature-kit--tree-detailed",
  bush: "nature-kit--plant-bush",
  rock: "nature-kit--rock-largea",
  flower: "nature-kit--flower-yellowa",
  truck: "car-kit--truck",
  van: "car-kit--van",
  woman: "mini-characters--character-female-a",
  man: "mini-characters--character-male-a",
};

export function createWorldScene(host, callbacks) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D Econia city. Drag to orbit, scroll to zoom, right-drag to pan.",
  );
  renderer.domElement.tabIndex = 0;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a4c6cc");
  scene.fog = new THREE.Fog("#a4c6cc", 105, 200);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.2, 260);
  camera.position.set(61, 62, 75);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-1, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 13;
  controls.maxDistance = 140;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = 1.24;
  controls.maxTargetRadius = 55;
  controls.cursor.set(0, 0, 0);
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.75;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const hemi = new THREE.HemisphereLight("#e8f3ff", "#69754c", 1.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0cf", 2.4);
  sun.position.set(-26, 48, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -60,
    right: 60,
    top: 60,
    bottom: -60,
    near: 1,
    far: 125,
  });
  sun.shadow.normalBias = 0.055;
  sun.shadow.bias = -0.00012;
  sun.shadow.blurSamples = 8;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#b8d5ef", 0.65);
  fill.position.set(25, 12, -25);
  scene.add(fill);

  const geometries = new Set(),
    materials = new Map(),
    textures = new Set(),
    models = new Map(),
    entities = new Map();
  let props = null,
    positions = new Map(),
    disposed = false,
    frame = 0,
    lastFrame = 0,
    ready = false,
    dirty = true,
    cameraTween = null;
  let signature = "",
    lastCommand = null,
    pointerDown = null,
    hoveredId = null,
    deliveries = [],
    deliveryEpoch = 0;
  const dynamic = new THREE.Group();
  scene.add(dynamic);
  const pickables = [],
    rotors = [];
  function material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra }),
      );
    return materials.get(key);
  }
  function mesh(geometry, color, parent = scene, extra = {}) {
    geometries.add(geometry);
    const o = new THREE.Mesh(
      geometry,
      typeof color === "string" ? material(color, extra) : color,
    );
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(parent, x, y, z, w, h, d, color, rotation = 0) {
    const o = mesh(new THREE.BoxGeometry(w, h, d), color, parent);
    o.position.set(x, y, z);
    o.rotation.y = rotation;
    return o;
  }
  function cylinder(
    parent,
    x,
    y,
    z,
    top,
    bottom,
    height,
    color,
    segments = 12,
  ) {
    const o = mesh(
      new THREE.CylinderGeometry(top, bottom, height, segments),
      color,
      parent,
    );
    o.position.set(x, y, z);
    return o;
  }
  function sphere(parent, x, y, z, r, color, scale = [1, 1, 1]) {
    const o = mesh(new THREE.IcosahedronGeometry(r, 1), color, parent);
    o.position.set(x, y, z);
    o.scale.set(...scale);
    return o;
  }
  function path(points, radius, color, parent = scene) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    return mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(6, points.length * 5),
        radius,
        5,
        false,
      ),
      color,
      parent,
    );
  }
  function shapeMesh(points, depth, color, side, y) {
    const s = new THREE.Shape();
    points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.3,
      bevelThickness: 0.2,
    });
    geometries.add(g);
    const o = new THREE.Mesh(g, [material(color), material(side)]);
    o.rotation.x = -Math.PI / 2;
    o.position.y = y;
    o.receiveShadow = true;
    o.castShadow = true;
    scene.add(o);
    return o;
  }
  function roof(parent, x, y, z, w, d, h, color) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: false,
    });
    const o = mesh(g, color, parent);
    o.position.set(x, y, z - d / 2);
    return o;
  }
  function windowPane(parent, x, y, z, w = 0.7, h = 0.9) {
    box(parent, x, y, z, w + 0.13, h + 0.13, 0.1, "#f0dfbd");
    box(parent, x, y, z + 0.06, w, h, 0.05, "#456f79");
    box(parent, x, y, z + 0.1, 0.035, h, 0.03, "#e2d4b4");
    box(parent, x, y, z + 0.1, w, 0.035, 0.03, "#e2d4b4");
  }
  function lamp(x, z) {
    const g = new THREE.Group();
    scene.add(g);
    cylinder(g, x, 2.5, z, 0.055, 0.09, 2.8, "#45534c", 6);
    box(g, x, 3.94, z, 0.35, 0.12, 0.35, "#43514a");
    box(g, x, 3.75, z, 0.23, 0.27, 0.23, "#ffe5a2");
  }
  function bench(x, z, angle = 0) {
    const g = new THREE.Group();
    g.position.set(x, 1.08, z);
    g.rotation.y = angle;
    scene.add(g);
    for (let i = 0; i < 3; i++)
      box(g, 0, 0.4, i * 0.12, 1.4, 0.09, 0.09, "#a98962");
    for (const x of [-0.5, 0.5]) {
      box(g, x, 0.2, 0.1, 0.09, 0.4, 0.4, "#415649");
      box(g, x, 0.7, -0.02, 0.08, 0.7, 0.08, "#415649");
    }
    for (let i = 0; i < 2; i++)
      box(g, 0, 0.73 + i * 0.18, -0.04, 1.4, 0.12, 0.07, "#b7976a");
  }
  function fence(x, z, length, angle = 0) {
    const g = new THREE.Group();
    g.position.set(x, 1.04, z);
    g.rotation.y = angle;
    scene.add(g);
    for (let i = 0; i <= length; i++)
      box(g, i - length / 2, 0.4, 0, 0.09, 0.8, 0.09, "#e0d2ac");
    box(g, 0, 0.38, 0, length, 0.07, 0.07, "#e0d2ac");
    box(g, 0, 0.65, 0, length, 0.07, 0.07, "#e0d2ac");
  }
  function crate(parent, x, z, y = 1.05) {
    box(parent, x, y + 0.32, z, 0.64, 0.64, 0.64, "#ac7d4b");
    for (const zz of [-0.33, 0.33]) {
      box(parent, x, y + 0.32, z + zz, 0.68, 0.08, 0.04, "#725739");
      box(parent, x, y + 0.58, z + zz, 0.68, 0.07, 0.04, "#d2aa72");
    }
    box(parent, x, y + 0.64, z, 0.07, 0.025, 0.67, "#80613e");
  }

  // Terrain, cut shoreline and canal are actual geometry, rather than a backdrop image.
  const sea = mesh(new THREE.PlaneGeometry(400, 400), "#75adbb", scene, {
    roughness: 0.38,
    metalness: 0.15,
  });
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.45;
  sea.castShadow = false;
  const coast = [
    [-38, -20],
    [-32, -27],
    [-14, -29],
    [-5, -26],
    [10, -28],
    [26, -22],
    [31, -9],
    [34, 7],
    [31, 22],
    [13, 26],
    [9, 26],
    [9, -8],
    [7, -12],
    [4, -8],
    [4, 26],
    [-8, 26],
    [-27, 24],
    [-36, 10],
  ];
  shapeMesh(coast, 1.2, "#9eb778", "#b3a383", -0.5);
  shapeMesh(
    [
      [-38, -20],
      [-32, -27],
      [-14, -29],
      [-5, -26],
      [10, -28],
      [26, -22],
      [31, -9],
      [34, 7],
      [31, 22],
      [13, 26],
      [9, 26],
      [9, -8],
      [7, -12],
      [4, -8],
      [4, 26],
      [-8, 26],
      [-27, 24],
      [-36, 10],
    ],
    0.1,
    "#a2ba7e",
    "#c6b593",
    0.7,
  );
  for (let i = 0; i < 19; i++) {
    const x = -39 + i * 4,
      z = 30 + Math.sin(i * 2.1) * 2;
    path(
      [
        [x, -0.31, z],
        [x + 1.3, -0.31, z + 0.1],
        [x + 2.8, -0.31, z],
      ],
      0.025,
      "#b3d5d8",
    );
  }
  for (let i = 0; i < 13; i++) {
    const x = 36 + (i % 3) * 3,
      z = -20 + i * 3.6;
    path(
      [
        [x, -0.31, z],
        [x + 1.4, -0.31, z],
        [x + 2, -0.31, z + 0.3],
      ],
      0.02,
      "#c3dedb",
    );
  }
  // Stone-lined canal and the two neighborhood bridges.
  box(scene, 3.85, 0.7, 8, 0.45, 1.4, 36, "#a7a68e");
  box(scene, 9.15, 0.7, 8, 0.45, 1.4, 36, "#a7a68e");
  for (const z of [-1, 12]) {
    box(scene, 6.5, 1.16, z, 7.1, 0.45, 3.1, "#d6c7a5");
    for (const side of [-1, 1]) {
      box(scene, 6.5, 1.75, z + side * 1.45, 7, 0.18, 0.17, "#e8d9b9");
      for (let x = 3.4; x < 10; x += 0.65)
        box(scene, x, 1.45, z + side * 1.45, 0.14, 0.55, 0.15, "#c0b799");
    }
    for (const x of [4.1, 8.9])
      box(scene, x, 0.4, z, 0.55, 1.8, 2.6, "#b1aa91");
  }
  // Paved streets, raised sidewalks and compact block structure.
  for (const [x, z, w, d] of [
    [-17, -1, 39, 2.5],
    [-17, 12, 39, 2.5],
    [20, -1, 23, 2.5],
    [20, 12, 23, 2.5],
    [-12, 0, 2.5, 47],
    [0, 0, 2.5, 47],
    [20, -12, 2.5, 23],
    [23, 12, 2.5, 24],
    [-24, -13, 2.3, 24],
  ]) {
    box(scene, x, 1.04, z, w + 0.7, 0.12, d + 0.7, "#d3d2b6");
    box(scene, x, 1.11, z, w, 0.065, d, "#e4ddc4");
    const along = w > d;
    for (let a = -(along ? w : d) / 2 + 0.4; a < (along ? w : d) / 2; a += 1.2)
      box(
        scene,
        x + (along ? a : 0),
        1.15,
        z + (along ? 0 : a),
        along ? 0.35 : 0.025,
        0.012,
        along ? 0.025 : 0.35,
        "#c6bfa7",
      );
  }
  // Small rear hills create an inhabited landscape and a natural horizon.
  sphere(scene, -26, 1.1, -23, 7, "#8ba66e", [1, 0.25, 0.7]);
  sphere(scene, -8, 1.1, -25, 5, "#9bb17b", [1.4, 0.27, 0.75]);
  sphere(scene, 5, 1, -25, 6, "#8ea979", [1, 0.25, 0.65]);
  // Commons square, fountain, planters and seating.
  const plaza = cylinder(scene, -5, 1.09, -6, 3.45, 3.45, 0.12, "#d7d1b4", 40);
  for (let ring = 0; ring < 3; ring++) {
    const t = mesh(
      new THREE.TorusGeometry(2.6 + ring * 0.27, 0.018, 4, 50),
      "#b7b89d",
    );
    t.rotation.x = -Math.PI / 2;
    t.position.set(-5, 1.17, -6);
  }
  cylinder(scene, -5, 1.35, -6, 1.28, 1.45, 0.45, "#bdbba0", 20);
  cylinder(scene, -5, 1.61, -6, 1.14, 1.14, 0.06, "#7ca9ad", 28);
  cylinder(scene, -5, 2, -6, 0.18, 0.27, 0.85, "#dcd4b9");
  cylinder(scene, -5, 2.41, -6, 0.62, 0.26, 0.15, "#d5cdb4", 18);
  for (const [x, z, r] of [
    [-8, -5, 0.6],
    [-2, -7, -0.6],
    [-5, -9, 0],
    [-5, -3, Math.PI],
  ])
    bench(x, z, r);
  for (const [x, z] of [
    [-10, 1],
    [-10, 10],
    [-1, 1],
    [-1, 10],
    [11, 1],
    [11, 10],
    [27, 1],
    [27, 10],
    [-30, 1],
    [-30, 10],
    [14, -20],
    [26, -20],
  ])
    lamp(x, z);
  // Cultivated rows have no production animation unless the world records a batch.
  for (const [x, z] of [
    [-30, -22],
    [-20, -22],
    [-33, -17],
  ]) {
    box(scene, x, 1.1, z, 6, 0.1, 4.4, "#9c895b");
    for (let row = 0; row < 6; row++) {
      box(scene, x - 2.5 + row, 1.18, z, 0.55, 0.1, 4, "#7c9852");
      for (let j = 0; j < 7; j++)
        sphere(
          scene,
          x - 2.5 + row,
          1.35,
          z - 1.7 + j * 0.55,
          0.12,
          "#b8bc62",
          [0.6, 1.5, 0.6],
        );
    }
    fence(x, z - 2.5, 6);
  }
  fence(-34, -12, 12, Math.PI / 2);
  fence(-23, -25, 18);
  // Harbor quay, boardwalks, mooring posts and a parked workboat.
  box(scene, 25, 1, 23.5, 15, 0.4, 2.8, "#b5ad92");
  for (const x of [19, 25, 30]) {
    box(scene, x, 0.72, 28, 1.9, 0.3, 8, "#b69c77");
    for (let z = 24.5; z < 32; z += 0.48)
      box(scene, x, 0.9, z, 1.95, 0.04, 0.05, "#8b7d64");
    for (const dx of [-0.7, 0.7])
      for (const z of [25, 30.5])
        cylinder(scene, x + dx, 0.5, z, 0.11, 0.13, 1.4, "#7c705c", 7);
  }
  const boat = new THREE.Group();
  scene.add(boat);
  boat.position.set(27.4, -0.15, 29);
  boat.rotation.y = 0.2;
  shapeBoat(boat);
  function shapeBoat(g) {
    const hull = mesh(
      new THREE.CylinderGeometry(0.9, 0.65, 3.9, 5),
      "#3d6978",
      g,
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.35;
    box(g, 0, 0.8, 0, 1.35, 0.2, 2.8, "#d6b78c");
    box(g, 0, 1.35, 0.3, 1.1, 1, 1.2, "#e7dfc4");
    box(g, 0, 1.5, 0.94, 0.7, 0.4, 0.04, "#608590");
    cylinder(g, 0.48, 2.1, -0.6, 0.04, 0.04, 2.4, "#695d47", 6);
  }
  for (const [x, z] of [
    [22, 22],
    [24, 22],
    [30, 21],
  ])
    crate(scene, x, z);
  // Market stalls, parasol tables and street furniture are scenery, never simulated businesses.
  for (const [i, x] of [11.4, 20, 25].entries()) {
    box(scene, x, 1.45, 2, 2, 0.75, 1.15, "#ac8660");
    for (const dx of [-0.9, 0.9])
      box(scene, x + dx, 2.3, 2, 0.06, 1.9, 0.06, "#76664d");
    box(
      scene,
      x,
      3.14,
      2,
      2.5,
      0.14,
      1.7,
      ["#c87752", "#d4ac51", "#5e8a8b"][i],
    );
    for (let j = 0; j < 5; j++)
      sphere(
        scene,
        x - 0.7 + j * 0.32,
        1.93,
        2,
        0.15,
        ["#d79f4b", "#8caa61", "#c58155"][i],
      );
  }

  const selection = mesh(
    new THREE.RingGeometry(1.05, 1.23, 48),
    "#f4b544",
    dynamic,
    { side: THREE.DoubleSide, emissive: "#b97b1f", emissiveIntensity: 0.25 },
  );
  selection.rotation.x = -Math.PI / 2;
  selection.visible = false;
  selection.castShadow = false;
  const selectionBeam = mesh(
    new THREE.CylinderGeometry(0.1, 0.4, 1.7, 6),
    "#f4b544",
    dynamic,
    { transparent: true, opacity: 0.28 },
  );
  selectionBeam.visible = false;
  selectionBeam.castShadow = false;
  const deliveryGroup = new THREE.Group();
  scene.add(deliveryGroup);

  function loadModel(key) {
    const name = assets[key];
    return new GLTFLoader()
      .loadAsync(name.startsWith("/") ? name : `${ROOT}${name}.glb`)
      .then((gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const root = gltf.scene;
        root.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            geometries.add(o.geometry);
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              m.roughness = Math.max(0.65, m.roughness || 0);
              if (m.map) textures.add(m.map);
            }
          }
        });
        models.set(key, root);
        dirty = true;
        return root;
      });
  }
  function instance(
    key,
    parent,
    x,
    z,
    width,
    rotation = 0,
    y = 1.12,
    fitHeight = false,
  ) {
    const source = models.get(key);
    if (!source) return null;
    const root = cloneSkeleton(source);
    if (key === "woman" || key === "man") {
      root.traverse((o) => {
        if (o.name === "arm-left") o.rotation.z = -1.2;
        if (o.name === "arm-right") o.rotation.z = 1.2;
      });
      root.updateMatrixWorld(true);
    }
    const bounds = new THREE.Box3().setFromObject(root),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    const scale = width / (fitHeight ? size.y : Math.max(size.x, size.z));
    root.position.set(-center.x, -bounds.min.y, -center.z);
    const normalized = new THREE.Group();
    normalized.add(root);
    normalized.scale.setScalar(scale);
    const wrapper = new THREE.Group();
    wrapper.add(normalized);
    wrapper.position.set(x, y, z);
    wrapper.rotation.y = rotation;
    parent.add(wrapper);
    return wrapper;
  }
  function simpleTree(x, z, height = 3.3, tint = "#5f8454") {
    const g = new THREE.Group();
    scene.add(g);
    cylinder(
      g,
      x,
      1.1 + height * 0.35,
      z,
      0.11,
      0.17,
      height * 0.7,
      "#8b7355",
      6,
    );
    sphere(g, x, 1.1 + height * 0.75, z, height * 0.4, tint, [1, 1.25, 1]);
    return g;
  }
  function addDecorations() {
    const houses = [
      [-30, 17, "homeA", 4.7],
      [-33, 7, "homeH", 4.0],
      [-23, 17, "homeC", 4.7],
      [-7, -17, "homeF", 4.9],
      [-7, -10, "homeL", 4.7],
      [-19, 21, "homeQ", 4.3],
      [-32, -3, "homeA", 3.8],
      [-7, 21, "homeH", 3.6],
      [22, -21, "shopF", 5.0],
      [13, -21, "shopD", 5.0],
    ];
    for (const [i, [x, z, key, width]] of houses.entries())
      instance(key, scene, x, z, width, i % 2 ? Math.PI : 0);
    const trees = [
      [-35, -18],
      [-34, -23],
      [-30, -25],
      [-25, -26],
      [-17, -25],
      [-12, -25],
      [-9, -24],
      [-3, -25],
      [2, -25],
      [8, -25],
      [29, -18],
      [31, -13],
      [32, -7],
      [32, 0],
      [-34, 5],
      [-35, 11],
      [-31, 21],
      [-26, 23],
      [-22, 23],
      [-13, 23],
      [-3, 24],
      [1, 21],
      [1, 16],
      [-1, -9],
      [-10, -4],
      [-2, -4],
      [-10, -8],
      [12, -17],
      [11, -12],
      [11, -7],
      [30, 18],
      [31, 14],
      [-17, -3],
      [-25, 2],
      [-20, 2],
      [-8, 2],
      [-3, 2],
      [-19, -18],
      [-33, -8],
      [-33, -13],
      [-15, -24],
      [5, -23],
      [8, -23],
    ];
    for (const [i, [x, z]] of trees.entries())
      instance(
        i % 4 === 0 ? "pine" : i % 3 === 0 ? "tree" : "oak",
        scene,
        x,
        z,
        2.1 + (i % 3) * 0.45,
        i * 0.83,
      );
    for (const [i, [x, z]] of trees.entries()) {
      if (i % 3 === 0) instance("bush", scene, x + 0.8, z + 0.8, 1.05);
      if (i % 7 === 0) instance("rock", scene, x - 0.8, z + 0.8, 0.85);
    }
    for (let i = 0; i < 14; i++)
      instance("flower", scene, -9 + i * 0.5, -2.7, 0.3, i);
    instance("truck", scene, 25, 20.5, 3.2, Math.PI / 2);
    instance("van", scene, 29, -3, 2.5, Math.PI);
    for (const [x, z] of [
      [12, -3],
      [23, -3],
    ]) {
      instance("parasol", scene, x, z, 2.2);
      cylinder(scene, x, 1.6, z, 0.6, 0.6, 0.1, "#b49467", 12);
    }
    rebuildEntities();
    dirty = true;
  }
  function business(e) {
    const g = new THREE.Group();
    g.userData.entityId = e.id;
    dynamic.add(g);
    const customKey = {
      FOOD: "econiaBakery",
      FARMING: "econiaFarm",
      MILLING: "econiaMill",
      TRANSPORT: "econiaHarbor",
    }[e.industry];
    const custom = customKey && instance(customKey, g, 0, 0, 6.1, 0, 0);
    if (!custom) {
      box(g, 0, 0.05, 0, 6.1, 0.13, 5.5, "#d7d2b7");
      if (e.industry === "FOOD") {
        box(g, 0, 1.6, 0, 4.7, 3.1, 3.8, "#eddbb4");
        roof(g, 0, 3.15, 0, 5.25, 4.3, 1.7, "#b86043");
        box(g, -1.38, 0.95, 1.96, 0.95, 1.9, 0.12, "#5e716a");
        windowPane(g, 1, 1.25, 1.97, 1.55, 1.3);
        windowPane(g, -1.15, 2.65, 1.97, 0.7, 0.65);
        windowPane(g, 1.1, 2.65, 1.97, 0.7, 0.65);
        box(g, 0.7, 2.25, 2.4, 3, 0.12, 1.1, "#d2a24b", 0.02);
        for (let i = 0; i < 7; i++)
          box(g, -0.64 + i * 0.43, 2.27, 2.4, 0.22, 0.13, 1.13, "#f4e9c8");
        box(g, 1.5, 3.9, -0.8, 0.6, 2.2, 0.65, "#c5b294");
        box(g, 1.5, 5.05, -0.8, 0.8, 0.18, 0.82, "#e0ceab");
        box(g, 2.95, 0.7, 1.5, 0.8, 1.35, 0.95, "#8a6a47");
        box(g, 2.95, 1.42, 1.5, 1, 0.12, 1.05, "#c69c61");
        for (let i = 0; i < 3; i++)
          sphere(
            g,
            2.7 + i * 0.24,
            1.6,
            1.5,
            0.2,
            "#d9ac65",
            [0.55, 0.65, 1.2],
          );
        // A bread-shaped hanging sign identifies the actual bakery even without labels.
        box(g, -2.55, 2.8, 2.15, 0.08, 0.08, 1.4, "#68573f");
        sphere(g, -2.55, 2.25, 2.55, 0.45, "#d8ac65", [0.5, 0.7, 1]);
      } else if (e.industry === "FARMING") {
        box(g, 0, 1.45, 0, 4.5, 2.8, 3.7, "#c47a55");
        roof(g, 0, 2.88, 0, 5, 4.2, 1.55, "#556f62");
        box(g, 0, 1, 1.9, 1.7, 1.9, 0.12, "#765240");
        for (const x of [-0.75, 0.75])
          box(g, x, 1, 1.99, 0.09, 1.9, 0.05, "#ead8b4");
        box(g, 0, 1, 1.99, 1.6, 0.09, 0.05, "#ead8b4");
        cylinder(g, 3, 2, -0.5, 0.8, 0.8, 3.8, "#d5d8c0", 14);
        const cap = mesh(new THREE.ConeGeometry(0.87, 0.8, 14), "#7f9584", g);
        cap.position.set(3, 4.3, -0.5);
        for (let i = 0; i < 3; i++)
          cylinder(g, -2.1 + i * 0.8, 0.5, 2.9, 0.35, 0.35, 0.8, "#c6b06c", 8);
      } else if (e.industry === "MILLING") {
        instance("shopC", g, 0, 0, 4.8, 0, 0);
        cylinder(g, -1, 2, -0.6, 1, 1.6, 4, "#e1d5b3", 8);
        roof(g, -1, 4, -0.6, 2.4, 2.1, 1.4, "#677f78");
        const rotor = new THREE.Group();
        rotor.position.set(-1, 3.7, 1.1);
        g.add(rotor);
        for (let i = 0; i < 4; i++) {
          const blade = new THREE.Group();
          blade.rotation.z = (i * Math.PI) / 2;
          rotor.add(blade);
          box(blade, 0, 1.1, 0, 0.22, 2.2, 0.1, "#806b4c");
          box(blade, 0.26, 1.4, 0.01, 0.55, 1.3, 0.07, "#e4cf9e");
        }
        const hub = mesh(
          new THREE.SphereGeometry(0.22, 8, 6),
          "#806b4c",
          rotor,
        );
        rotors.push({ rotor, id: e.id });
        for (let i = 0; i < 3; i++) crate(g, 2.5, 1.5 - i * 0.85, 0);
      } else {
        box(g, 0, 1.5, 0, 5.2, 3, 4.1, "#8eafba");
        roof(g, 0, 3, 0, 5.65, 4.5, 1.1, "#527583");
        for (let i = 0; i < 2; i++) {
          box(g, -1.35 + i * 2.7, 1.3, 2.1, 1.7, 2.5, 0.1, "#456674");
          for (let j = 0; j < 5; j++)
            box(
              g,
              -1.35 + i * 2.7,
              0.35 + j * 0.4,
              2.17,
              1.65,
              0.04,
              0.04,
              "#78959d",
            );
        }
        for (let i = 0; i < 3; i++) crate(g, -2 + i * 0.78, 2.8, 0);
        instance("truck", g, 3.4, 0.2, 2.6, Math.PI / 2, 0);
      }
    }
    if (custom && e.industry === "MILLING") {
      const rotor = new THREE.Group();
      rotor.position.set(-0.45, 3.7, 1.72);
      g.add(rotor);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Group();
        blade.rotation.z = (i * Math.PI) / 2;
        rotor.add(blade);
        box(blade, 0, 1.1, 0, 0.16, 2.2, 0.1, "#806b4c");
        box(blade, 0.23, 1.4, 0.01, 0.5, 1.25, 0.07, "#e4cf9e");
      }
      mesh(new THREE.SphereGeometry(0.2, 8, 6), "#806b4c", rotor);
      rotors.push({ rotor, id: e.id });
    }
    box(g, 0, 0.13, 3, 3, 0.16, 0.8, "#d1c6a9");
    const hit = mesh(new THREE.BoxGeometry(6, 5.3, 5), "#ffffff", g, {
      transparent: true,
      opacity: 0,
      visible: false,
      depthWrite: false,
    });
    hit.position.y = 2.5;
    hit.castShadow = false;
    hit.receiveShadow = false;
    pickables.push(hit);
    batchBusiness(g);
    return g;
  }
  function batchBusiness(root) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(),
      buckets = new Map();
    root.traverse((o) => {
      if (
        !o.isMesh ||
        o.isSkinnedMesh ||
        Array.isArray(o.material) ||
        !o.material.visible
      )
        return;
      let ancestor = o;
      while (ancestor && ancestor !== root) {
        if (rotors.some((r) => r.rotor === ancestor)) return;
        ancestor = ancestor.parent;
      }
      const attrs = Object.keys(o.geometry.attributes).sort().join(",");
      const key = o.material.uuid + ":" + attrs;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const copies = objects.map((o) => {
        const g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        return g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      });
      const geometry = mergeGeometries(copies, false);
      copies.forEach((g) => g.dispose());
      if (!geometry) continue;
      const combined = mesh(geometry, objects[0].material, root);
      combined.userData.entityId = root.userData.entityId;
      objects.forEach((o) => o.removeFromParent());
    }
  }
  function resident(e, index) {
    const g = new THREE.Group();
    g.userData.entityId = e.id;
    dynamic.add(g);
    if (
      (e.id === "person_199" || parseInt(e.id.split("_")[1]) % 10 === 0) &&
      models.has("woman")
    ) {
      instance(
        e.id === "person_199" ? "woman" : "man",
        g,
        0,
        0,
        1.45,
        0,
        0,
        true,
      );
    } else {
      const color = ["#5e8582", "#bc795a", "#647e98", "#a28b58", "#6d8b5a"][
        index % 5
      ];
      cylinder(g, 0, 0.6, 0, 0.17, 0.22, 0.62, color, 7);
      sphere(
        g,
        0,
        1.13,
        0,
        0.23,
        ["#d9b38a", "#bc8768", "#e5c5a1", "#9c7059"][index % 4],
      );
      sphere(g, 0, 1.29, -0.02, 0.24, "#514b3f", [1, 0.55, 1]);
      for (const x of [-0.1, 0.1])
        box(g, x, 0.17, 0, 0.12, 0.37, 0.14, "#43565a");
    }
    const hit = mesh(new THREE.SphereGeometry(0.55, 6, 5), "#ffffff", g, {
      transparent: true,
      opacity: 0,
      visible: false,
      depthWrite: false,
    });
    hit.position.y = 0.8;
    hit.castShadow = false;
    hit.receiveShadow = false;
    pickables.push(hit);
    return g;
  }
  function rebuildEntities() {
    if (!props) return;
    for (const e of props.w.entities.filter((e) =>
      ["PERSON", "BUSINESS"].includes(e.type),
    )) {
      if (!entities.has(e.id))
        entities.set(
          e.id,
          e.type === "BUSINESS" ? business(e) : resident(e, entities.size),
        );
    }
    positionEntities();
  }
  function positionEntities() {
    renderer.shadowMap.needsUpdate = true;
    for (const e of props.w.entities) {
      const g = entities.get(e.id),
        p = positions.get(e.id);
      if (g && p) {
        g.position.set(p.x, 1.15, p.z);
        g.visible = e.type === "BUSINESS" || props.layer !== "Places";
      }
    }
    const p = positions.get(props.selected),
      e = props.w.entities.find((e) => e.id === props.selected);
    selection.visible = Boolean(p);
    selectionBeam.visible = Boolean(p);
    if (p) {
      selection.position.set(p.x, 1.23, p.z);
      selection.scale.setScalar(e?.type === "BUSINESS" ? 2.65 : 0.7);
      selectionBeam.position.set(p.x, 2.5, p.z);
    }
    dirty = true;
  }
  function syncDelivery() {
    const key = `${props.w.cycle}:${props.fresh}`;
    if (signature === key) return;
    signature = key;
    for (const o of [...deliveryGroup.children]) {
      deliveryGroup.remove(o);
      o.traverse((m) => {
        if (m.geometry) {
          m.geometry.dispose();
          geometries.delete(m.geometry);
        }
      });
    }
    deliveries = [];
    if (!props.fresh) return;
    for (const t of recordedDeliveries(props.w, positions)) {
      const from = positions.get(t.credit),
        to = positions.get(t.debit);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(from.x, 1.35, from.z + 2.5),
        new THREE.Vector3(from.x, 1.35, 12),
        new THREE.Vector3(to.x, 1.35, 12),
        new THREE.Vector3(to.x, 1.35, to.z + 2.5),
      ]);
      const trail = mesh(
        new THREE.TubeGeometry(curve, 28, 0.035, 4, false),
        "#ebd48a",
        deliveryGroup,
      );
      trail.castShadow = false;
      const parcel = mesh(
        new THREE.BoxGeometry(0.38, 0.38, 0.38),
        "#e0a542",
        deliveryGroup,
      );
      deliveries.push({ curve, parcel });
    }
    deliveryEpoch = performance.now();
  }
  function update(next) {
    props = next;
    positions = worldPositions(next.w);
    if (ready) rebuildEntities();
    positionEntities();
    syncDelivery();
    dirty = true;
  }
  function command(next, selected) {
    if (!next || !props) return;
    if (
      lastCommand &&
      next.zoom !== lastCommand.zoom &&
      next.x === lastCommand.x &&
      next.y === lastCommand.y
    ) {
      const ratio = lastCommand.zoom / next.zoom;
      camera.position.copy(
        controls.target
          .clone()
          .add(
            camera.position.clone().sub(controls.target).multiplyScalar(ratio),
          ),
      );
      controls.update();
      dirty = true;
      lastCommand = { ...next };
      return;
    }
    let target = new THREE.Vector3(-1, 0, 6),
      distance = 100;
    if (next.focus && positions.has(next.focus)) {
      const p = positions.get(next.focus);
      target.set(p.x, 1, p.z);
      distance = 30;
    } else if (next.focusDistrict) {
      const d = worldDistricts.find((d) => d.id === next.focusDistrict);
      if (d) {
        target.set(d.x, 1, d.z);
        distance = 48;
      }
    } else if (next.zoom > 1.1 && selected && positions.has(selected)) {
      const p = positions.get(selected);
      target.set(p.x, 1, p.z);
      distance = 37;
    }
    if (window.innerWidth < 641) distance *= 1.4;
    viewFocus = Boolean(
      next.focus || next.focusDistrict || (next.zoom > 1.1 && selected),
    );
    applyViewOffset();
    const direction = new THREE.Vector3(0.58, 0.63, 0.72).normalize();
    cameraTween = {
      start: performance.now(),
      from: camera.position.clone(),
      to: target.clone().addScaledVector(direction, distance),
      fromTarget: controls.target.clone(),
      target,
    };
    if (reducedMotion) {
      camera.position.copy(cameraTween.to);
      controls.target.copy(target);
      cameraTween = null;
      controls.update();
    }
    lastCommand = { ...next };
    dirty = true;
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  function hit(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      (-(ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const found = raycaster
      .intersectObjects(pickables, false)
      .find((h) => h.object.parent.visible);
    let o = found?.object;
    while (o && !o.userData.entityId) o = o.parent;
    return o?.userData.entityId;
  }
  const touchPointers = new Set();
  let multiTouch = false;
  function down(ev) {
    if (ev.pointerType === "touch") {
      touchPointers.add(ev.pointerId);
      if (touchPointers.size > 1) multiTouch = true;
    }
    if (ev.button !== 0) return;
    pointerDown = { x: ev.clientX, y: ev.clientY };
    cameraTween = null;
  }
  function up(ev) {
    if (ev.pointerType === "touch") {
      touchPointers.delete(ev.pointerId);
      if (multiTouch) {
        if (!touchPointers.size) multiTouch = false;
        pointerDown = null;
        return;
      }
    }
    if (
      pointerDown &&
      Math.hypot(ev.clientX - pointerDown.x, ev.clientY - pointerDown.y) < 6
    ) {
      const id = hit(ev);
      if (id) callbacks.select(id);
    }
    pointerDown = null;
  }
  function move(ev) {
    if (pointerDown) return;
    const id = hit(ev);
    renderer.domElement.style.cursor = id ? "pointer" : "grab";
    if (id) {
      const e = props?.w.entities.find((e) => e.id === id);
      callbacks.hover({
        name: e.name,
        role: e.role || e.industry,
        x: ev.offsetX + 15,
        y: ev.offsetY - 15,
      });
    } else if (hoveredId) callbacks.hover(null);
    hoveredId = id;
  }
  function leave() {
    hoveredId = null;
    callbacks.hover(null);
  }
  function cancelPointer(ev) {
    touchPointers.delete(ev.pointerId);
    if (!touchPointers.size) multiTouch = false;
    pointerDown = null;
    leave();
  }
  function key(ev) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key))
      return;
    ev.preventDefault();
    const delta = new THREE.Vector3(
      ev.key === "ArrowLeft" ? -2 : ev.key === "ArrowRight" ? 2 : 0,
      0,
      ev.key === "ArrowUp" ? -2 : ev.key === "ArrowDown" ? 2 : 0,
    );
    camera.position.add(delta);
    controls.target.add(delta);
    cameraTween = null;
    dirty = true;
  }
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", cancelPointer);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerleave", leave);
  renderer.domElement.addEventListener("keydown", key);
  const contextLost = (ev) => {
    ev.preventDefault();
    callbacks.unavailable();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  controls.addEventListener("change", () => {
    dirty = true;
  });
  let viewFocus = false;
  function applyViewOffset() {
    const { width, height } = host.getBoundingClientRect();
    if (viewFocus)
      camera.setViewOffset(
        width,
        height,
        width < 641 ? 0 : width * 0.12,
        width < 641 ? height * 0.32 : 0,
        width,
        height,
      );
    else camera.clearViewOffset();
  }
  const observer = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    applyViewOffset();
    camera.updateProjectionMatrix();
    dirty = true;
  });
  observer.observe(host);
  const projected = new THREE.Vector3();
  function labels() {
    const rect = host.getBoundingClientRect();
    for (const el of host.parentElement.querySelectorAll(
      "[data-world-anchor]",
    )) {
      const id = el.dataset.worldAnchor;
      let p, y;
      if (id.startsWith("district:")) {
        const d = worldDistricts.find((d) => d.id === id.slice(9));
        p = d;
        y = 7;
      } else {
        p = positions.get(id);
        const e = props?.w.entities.find((e) => e.id === id);
        y = e?.type === "BUSINESS" ? 7 : 3.2;
      }
      if (!p) continue;
      projected.set(p.x, y, p.z).project(camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width,
        yy = (-projected.y * 0.5 + 0.5) * rect.height;
      const inView =
        projected.z < 1 &&
        projected.z > -1 &&
        x > -100 &&
        x < rect.width + 100 &&
        yy > 0 &&
        yy < rect.height;
      const selected = props?.selected === id;
      const place = el.dataset.anchorKind === "place";
      el.style.visibility = inView ? "visible" : "hidden";
      el.style.transform = `translate(${x.toFixed(1)}px,${yy.toFixed(1)}px) translate(-50%,-100%)`;
      el.classList.toggle(
        "show-name",
        selected ||
          props?.layer === "Names" ||
          camera.position.distanceTo(controls.target) < 55,
      );
      el.style.zIndex = selected
        ? "12"
        : String(Math.round(5 - projected.z * 3));
      if (place)
        el.classList.toggle(
          "is-producing",
          Boolean(
            props?.fresh &&
            props.w.events.some(
              (e) =>
                e.entityId === id &&
                e.type === "PRODUCTION_COMPLETED" &&
                e.cycle === props.w.cycle,
            ),
          ),
        );
    }
  }
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (now - lastFrame < 32) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!props?.active || document.hidden) return;
    if (cameraTween) {
      const t = Math.min(1, (now - cameraTween.start) / 850),
        ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(cameraTween.from, cameraTween.to, ease);
      controls.target.lerpVectors(
        cameraTween.fromTarget,
        cameraTween.target,
        ease,
      );
      dirty = true;
      if (t === 1) cameraTween = null;
    }
    controls.update();
    const active = props.fresh && !reducedMotion;
    if (active) {
      for (const { rotor, id } of rotors)
        if (
          props.w.events.some(
            (e) =>
              e.entityId === id &&
              e.type === "PRODUCTION_COMPLETED" &&
              e.cycle === props.w.cycle,
          )
        ) {
          rotor.rotation.z += dt * 0.55;
          dirty = true;
        }
      const elapsed = (now - deliveryEpoch) / 1000;
      for (const [i, { curve, parcel }] of deliveries.entries()) {
        const t = Math.min(1, Math.max(0, (elapsed - i * 0.3) / 8));
        parcel.position.copy(curve.getPointAt(t));
        parcel.rotation.y += dt * 0.15;
        if (t < 1) dirty = true;
      }
    }
    // Update projected labels only when the scene or its camera changes.
    if (dirty) {
      labels();
      renderer.render(scene, camera);
      host.dataset.drawCalls = String(renderer.info.render.calls);
      host.dataset.camera = [
        ...camera.position.toArray(),
        ...controls.target.toArray(),
      ]
        .map((n) => n.toFixed(3))
        .join(",");
      host.dataset.entityCount = String(entities.size);
      host.dataset.modelCount = String(models.size);
      dirty = false;
    }
  }
  function disposeObject(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m?.dispose();
      }
    });
  }
  function optimizeScenery() {
    scene.updateMatrixWorld(true);
    const buckets = new Map();
    for (const root of [...scene.children]) {
      if (root === dynamic || root === deliveryGroup) continue;
      root.traverse((o) => {
        if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
        const key =
          o.material.uuid + ":" + o.castShadow + ":" + o.receiveShadow;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o);
      });
    }
    for (const objects of buckets.values()) {
      if (objects.length < 3) continue;
      const copies = objects.map((o) =>
        o.geometry.clone().applyMatrix4(o.matrixWorld),
      );
      const attrs = Object.keys(copies[0].attributes).sort().join(",");
      if (
        copies.some((g) => Object.keys(g.attributes).sort().join(",") !== attrs)
      ) {
        copies.forEach((g) => g.dispose());
        continue;
      }
      const geometry = mergeGeometries(copies, false);
      copies.forEach((g) => g.dispose());
      if (!geometry) continue;
      geometries.add(geometry);
      const combined = new THREE.Mesh(geometry, objects[0].material);
      combined.castShadow = objects[0].castShadow;
      combined.receiveShadow = objects[0].receiveShadow;
      scene.add(combined);
      objects.forEach((o) => o.removeFromParent());
    }
  }
  async function load() {
    const results = await Promise.allSettled(
      Object.keys(assets).map(loadModel),
    );
    if (disposed) return;
    // The city remains explorable if an optional scenery model fails to load.
    if (results.some((r) => r.status === "fulfilled")) addDecorations();
    else {
      for (const [i, d] of worldDistricts.entries())
        simpleTree(d.x - 4, d.z - 4, 3.5);
    }
    ready = true;
    rebuildEntities();
    optimizeScenery();
    callbacks.ready();
    dirty = true;
  }
  void load();
  controls.update();
  frame = requestAnimationFrame(animate);
  return {
    update,
    command,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      for (const [name, fn] of [
        ["pointerdown", down],
        ["pointerup", up],
        ["pointercancel", cancelPointer],
        ["pointermove", move],
        ["pointerleave", leave],
        ["keydown", key],
        ["webglcontextlost", contextLost],
      ])
        renderer.domElement.removeEventListener(name, fn);
      for (const g of geometries) g.dispose();
      const allMaterials = new Set(materials.values());
      scene.traverse((o) => {
        if (o.isMesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            allMaterials.add(m);
      });
      for (const m of allMaterials) m?.dispose();
      for (const t of textures) t.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
