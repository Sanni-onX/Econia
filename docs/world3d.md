# Econia 3D world

The World view now renders a real Three.js scene instead of the former SVG map. The existing player interface, people, businesses, sponsorship preview, follow state and recorded stories remain connected to their world identities.

## Scene

- Raised coastal terrain with a cut canal, two stone bridges, paved streets and sidewalks.
- Four distinct areas: farms and cultivated rows in Greenfield; bakeries and homes in the Commons; mills, shops and stalls in the Market Quarter; warehouses, a quay, boardwalks and a moored boat in the Harbor.
- Imported GLB houses, shops, vegetation, vehicles and character models; custom bakery, farm, mill and logistics premises.
- Directional sunlight, cached soft shadows, a perspective camera and contextual selection rings.
- Drag to orbit, scroll to zoom, right-drag to pan. Touch orbit/pinch/pan and keyboard arrow panning are supported. The accessible list remains available without WebGL 2.
- Locate and district controls animate the camera. Closing a contextual panel preserves it. Mobile focus keeps the selected area above the bottom sheet.

## External assets and tools

### Original Blender premises — 9 November update

Four original economic buildings are now authored in **Blender 4.5.9 LTS** and exported as local self-contained GLBs: bakery, farm, mill and harbor logistics. They replace the procedural business geometry when loaded; the procedural versions remain a loading/failure fallback. The city retains existing entity IDs, selection targets and real production-based mill animation.

The models include beveled foundations, mullioned windows, shop signs and awnings, roof courses, bread displays, a banded grain silo, barn bracing, flour storage, ribbed loading doors and a cargo hoist. Original source and editable scene are in [assets/blender](../assets/blender/). Geometry and matching UI renders can be reproduced with `build_city_assets.py`; `render_city_previews.py` updates just the profile pictures. The four exports total 2,139,044 bytes and carry a CC0 manifest beside them.

Blender is downloaded from the official vendor as a portable tool under the ignored private tools directory; the executable is not committed. Run the source with Blender's `--background --factory-startup --python` options. [Model review](screenshots/blender-premises.png), [in-world bakery](screenshots/blender-world-bakery.png), [mobile](screenshots/blender-world-mobile.png).

Higgsfield access recovered after account sign-in. Its **3D Jutsu** tools were used to create and review an original Commons pavilion in Blender 5.2, with two committed design revisions. The local 324,956-byte GLB and editable `.blend` source are included, with project/revision provenance under `models/higgsfield/`. The pavilion replaces the square's fountain when loaded. It is decorative shared architecture, not an extra business or a claim that real agents have met there. Its review lights/camera are removed on import so Econia's own world lighting stays authoritative. [Reviewed render](screenshots/higgsfield-pavilion.png).

Three.js **0.187.0** supplies the renderer, glTF loading and camera controls. Its MIT license is included under `apps/web/public/licenses/`.

The 21 downloaded models total 2,194,464 bytes. They were created by [Kenney](https://kenney.nl), released under CC0, and obtained as self-contained GLBs from the [Tiny Game Engine asset mirror](https://github.com/Hidencod/tge-assets), pinned to revision `ea2f2aa1ca8da0898330c97df8a5489976b051d0`. The source manifest and license ship beside the files. The app loads them locally and makes no runtime requests to the model provider. `node scripts/fetch-city-assets.mjs` reproduces the pinned download; passing a revision explicitly is an intentional asset update.

fal was connected and selected Tripo H3.1 for a custom bakery. Its submission journal was unavailable and the generation was blocked before submission. A follow-up journal lookup returned no job and explicitly disallowed an automatic new generation. No generated fal model is represented as part of this release.

## Data and rendering

Business and person placements use persistent IDs and recorded holdings/jobs. Only actual current-cycle purchase records can produce trade trails. Mill activity requires a recorded production event and a fresh world advance; delayed settlement or a paused/stale world stops economic motion. Decorative houses and vehicles do not imply additional simulated businesses or transactions.

The scene mounts once, retains its camera through contextual panels and navigation, batches static geometry, limits device pixel ratio, caches shadows, caps interactive updates at 30 frames per second, and skips rendering while inactive or unchanged. WebGL resources and listeners are disposed when unmounted.

## Validation

- Production build passes.
- 25 local tests pass; PostgreSQL integration is skipped without its test database. New tests cover 3D identity/placement, actual purchase-only trails, and every shipped GLB's header, size, version, license and source revision.
- Browser verification covers actual 3D rendering, loading all 21 model files, orbit controls, preserved camera on panel close, Mira and her bakery, mobile bottom sheets, and the sponsorship preview without submitting funds.
- Existing testnet settlement remains delayed by the operator allowance. The scene shows the last confirmed cycle and disables economic activity cues accordingly.

Screenshots: [overview](screenshots/world3d-overview.png), [Mira](screenshots/world3d-mira.png), [mobile](screenshots/world3d-mobile.png).
