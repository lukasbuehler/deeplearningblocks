# Playground validation, 3 October 2026

The production Angular app was exercised through local `wrangler dev` and Codex computer use. These results cover local browser behavior, not a live Cloudflare deployment or physical touch devices. Journey testing used a separate 127.0.0.1 origin so the existing localhost experiments were preserved.

## Learning and training

- A fresh board contained two loose endpoints. Dragging Flatten from the tray and adding Dense created the first chain.
- Image → Dense was rejected with an instruction to add Flatten. Tap-to-connect linked Image → Flatten; an actual wire drag linked Flatten → Dense. Moving the classifier socket near the Dense output snapped and connected it at 87% zoom.
- The first five-pass experiment reached 90.0% on the 500 held-out digits and unlocked Sigmoid/Tanh.
- Disconnecting the classifier, inserting Sigmoid, and retraining reached 88.8% and unlocked ReLU.
- ReLU plus a second Dense layer reached 91.0%. A repeat run on the final build reached 90.4%. These are observations, not guaranteed scores. The notebook retained all four recipes and results.
- Classifier probabilities and digit predictions were visible. Moving trained blocks and changing the viewport preserved the displayed prediction. Computational changes cleared it.
- Stop cancelled an actual run and returned control without adding an experiment or unlocking anything.
- Sandbox started with a separate empty board and notebook, exposed every activation, and trained a keyboard-connected Flatten → classifier model at 89.8%. Switching back restored Journey's board, chapter and notebook. Automated tests also verify that a Sandbox run at Journey chapter zero cannot advance Journey.

## Interaction and recovery

- Exercised tray dragging and tap/Enter placement, wire dragging, port tapping and keyboard connections, magnetic snapping, moving connected blocks apart, occupied-port disconnection, selecting a visible SVG wire, deleting blocks, undoing incident-wire deletion, redo, and arrow-key movement.
- Scaled pointer dragging was checked at 87%, 83%, 90% and 100% views. Phone-width controls, tap placement, deletion/undo and the guide overlay were also exercised. Both guide-open and guide-closed layouts were inspected.
- Zoom controls and Fit all were exercised. Narrow-screen testing exposed an overly restrictive 35% minimum zoom; it now permits 10% so spread-out small networks fit on phones. Connector hit targets remain at least 44 screen pixels while the visual studs scale with the board.
- Reload retained board configuration, positions, mode, unlocks and experiments. Model weights intentionally did not survive reload.
- A disposable copy on port 8788 deliberately omitted the test dataset. The visible Retry digits control recovered after the asset was restored. This did not alter the normal preview's assets.
- Fresh paper's Keep playing action retained the disposable board. Start fresh restored two loose endpoints, zero results and the first chapter, and this state survived reload.
- Exact 390 × 844 DOM viewport checks confirmed no horizontal document overflow. Larger desktop and intermediate layouts were visually inspected. Screenshots are in `docs/screenshots/playground-desktop.jpg` and `playground-mobile.jpg`.

## Automated verification

- 15 Node tests pass: port compatibility and occupancy, cycle prevention, shape propagation, connection-ordered compilation, parameter counts, six-layer limits, loose-node exclusion, deletion/undo, scale-aware snapping, migration, corrupt/unavailable storage, dataset validation, and all four explicit activation functions matching equivalent embedded TensorFlow activations on image-shaped tensors.
- 8 Angular/ChromeHeadless tests pass: app rendering, reduced-motion styling, prediction retention for layout and loose-node edits, invalidation and undo for computational changes, movement versus computational edits during training, separate modes/notebooks/unlocks, cancellation, and dataset retry state. The browser suite also ran with `--force-prefers-reduced-motion`.
- Production build and `wrangler deploy --dry-run` pass. Initial transfer estimate is approximately 87 KB; the lazy TensorFlow runtime is approximately 196 KB, plus the bundled dataset.
- No deployment, account changes or DNS edits were performed.

## Bugs found and corrected

CDK stores free-drag positions in screen pixels and applies its scale internally, while the graph stores paper coordinates. Passing paper coordinates directly caused misplaced blocks and wires when zooming. Conversion now happens at the CDK boundary.

Snapped blocks hide their connection under touching ports. Occupied ports now select the connection and expose Disconnect. Compatible destination blocks are raised while connecting so a neighboring output cannot intercept the intended socket.

Angular template optional chaining can produce null for missing dimensions. Explicit nullish handling now displays Needs input and keeps Next digit disabled until data is loaded.

## Remaining validation limits

Computer use exercised mouse and keyboard input at phone and desktop viewport sizes. Physical multitouch behavior and device-specific GPU/CPU performance still need hardware testing. The project intentionally supports a single chain, the existing three chapters, the fixed MNIST subset and in-memory weights. Historical dates refer to influential papers, with the existing source notes retained. No server-side training or accounts are introduced.

## Follow-up: wire routing, shape contracts and drawing

- Replaced unconstrained cubic wires with orthogonal obstacle routing and rounded bends. Tests inspect every segment against source, target and intervening card interiors, including upward routes and snapped ports. Browser inspection confirmed the previously crossing connections now travel around the cards.
- Flatten now explicitly shows 28 × 28 × 1 → 784 numbers. Output contracts remain visible without an input; unknown vector widths are labeled N. Activation shows equal input/output widths.
- Added a pointer/pen/touch drawing pad, normalized image preview, Clear, Escape and focus restoration. Blank input disables submission. Drawings feed inference without altering model configuration or training/evaluation examples.
- Computer use drew a seven with two strokes, inspected its normalized preview, submitted it, and observed a trained model predict 7. Clear disabled submission again. The dialog was also inspected at phone width without horizontal overflow. Physical pen/touch hardware remains untested.
- Low-zoom testing found expanded connector hit targets covering the new drawing button. Their extra hit area now extends outward from each card instead of covering its controls.
- Added normalization, obstacle routing and custom inference state tests. Current totals: 18 Node tests and 9 Angular browser tests.
- Screenshots: `docs/screenshots/draw-digit.jpg` and `docs/screenshots/routed-wires-drawing.jpg`.
- Helper names and deterministic hint behavior are recorded as proposals in README. No assistant has been added yet, and the overfitting lesson remains deferred.

## Follow-up: Deep Learning Blocks branding and PyTorch export

- Restored the product name in the visible header and accessible home label. The colorful letters remain. The toolbar exposes PyTorch on desktop and Code on compact screens.
- Computer use inspected the generated model for the existing Dense 128 → ReLU → Dense 32 network. Its 104,938 parameters matched the playground. Switching to Full recipe displayed the training and evaluation code. Copy and download controls reported their requested actions; Escape restored focus to the toolbar button.
- The exact Python source read from the rendered code view ran locally with PyTorch 2.14.1 / torchvision 0.29.1. All five training passes completed, held-out accuracy was 90.4%, and the first held-out digit (8) was correctly predicted. This is one observed run, not a promised result. No browser-trained weights were exported.
- Validated the generated notebook with nbformat and parsed its Python cells. All four activation variants passed actual PyTorch forward/backward checks and produced normalized prediction probabilities. Reconstructed training and test subsets matched the bundled gzip records byte for byte.
- Added three Node export tests covering connection order, loose-block exclusion, dimensions, logits, every activation and shared script/notebook recipes. Added two Angular tests for incomplete-path guidance and the actual Python/notebook Blob contents and filenames. Current totals: 21 Node tests and 11 Angular/ChromeHeadless tests.
- The in-app browser did not expose a download event or saved path to computer use. File contents and filenames were verified through browser component tests; native save completion and upload/execution inside a signed-in Colab session remain unverified. The Python execution above used the rendered code, not a claimed browser download. No automatic Colab upload is implemented.
- Final computer-use checks covered 320, 390 and 1280 CSS-pixel widths. The header and export dialog had no horizontal document overflow. Temporary viewport overrides were reset. Screenshots: `docs/screenshots/pytorch-export.jpg` and `docs/screenshots/pytorch-mobile.jpg`.
- Production build completed without style-budget warnings, and the Workers dry run passed. No deployment or DNS changes were made.

## Follow-up: Blocky, activation identities and build discoveries (3 October 2026)

- Linear, Sigmoid, Tanh and ReLU now have separate visible card identities and SVG curve icons. Existing activation operations and saved boards retain their schema and behavior.
- Blocky is an original yellow SVG block with two red connector arms. Pure local rules explain missing pieces, gaps, rejected connections, chapter tasks and optional linear-stack advice. Target geometry follows node IDs and routed wires. Show me pans only on request and selects a targeted wire to expose Disconnect.
- Clues can be dismissed, requested again or muted. Configuration-specific dismissals and mute survive reload; layout changes do not reset them. The helper hides during board gestures, training, drawing and tray use. Static poses introduce no motion that needs a reduced-motion override.
- Computer use on an isolated port 8788 preview constructed Image → Flatten → Dense → Digit guess with keyboard connections, deliberately rejected Image → Dense, checked the first chapter, inserted Sigmoid, and checked the second chapter. Both unlocks happened before training, with an empty notebook. Reload retained the board and earned chapters. Sandbox restored separate loose endpoints and its empty notebook; service tests verify Sandbox checks cannot advance Journey.
- A real optional five-pass browser run of Dense 32 → Sigmoid completed with 90.2% held-out accuracy and one notebook entry. Blocky was hidden while training. This single observed result is not a promised score.
- Computer use verified Show me for nodes and wires, selection/disconnection, distinct Sigmoid card labels and propagated vector sizes, dragging with an open clue, mute across reload, immediate unmute, and 320, 351 and 1280 CSS-pixel layouts. The 351-pixel view had no document overflow. Viewport overrides were reset. Physical touch hardware was not tested in this pass.
- Visual testing found a pointing arm hidden by SVG paint order when aimed across the body. Choosing the outward arm fixes it. On phones, the centered wire-action bar collided with the helper and target placement could put a wire under its bubble. Compact left-aligned Disconnect and higher Show me targets fix both. Bubble height now follows the actual available paper height.
- Automated verification: 26 Node core tests and 14 Angular/ChromeHeadless tests pass, including clue priority/targets, stable dismissal context, mute/manual requests, all three construction checkpoints, incomplete builds, existing runtime equivalence, graph persistence and Sandbox isolation. Production build and Workers dry run pass. No deployment was performed.
- Screenshots: `docs/screenshots/blocky-desktop.png` and `docs/screenshots/blocky-mobile.png`. Existing user previews and their saves were left untouched.

## Follow-up: explicit score and probability blocks (3 October 2026)

- Cause of the apparent missing-layer success: V2 Digit guess compiled to an implicit trainable Dense(10) with softmax. Image → Flatten → Digit guess was therefore a valid linear classifier, despite hiding its learned weights from the board.
- Digit guess now only displays 10 probabilities. A Dense · 10 tray preset creates an ordinary configurable Dense with 10 units; the separate pink Softmax block performs a real TensorFlow softmax operation. Shape validation requires 10 scores. Probability ports have round pink connectors, and raw vectors cannot connect directly to the display. Invalid-width boards remain editable and persist safely.
- V3 migration exposes the old output operations in both workspaces while preserving unlocks, checked chapters and notebooks. V2 and V1 storage keys remain untouched. Tests cover unique migration IDs, no duplicate expansion on reload, incomplete boards, parameter counts and numerical equivalence with the old combined output. Six hidden Dense layers plus the explicit output layer remain supported.
- Blocky offers deterministic post-training experiments based on the current trained architecture. Tips distinguish a valid linear baseline from hidden nonlinear layers, target the relevant wire or block, and warn that more capacity does not guarantee better results. Historical chapter checks now look for hidden activations between Dense layers rather than treating output processing as a hidden nonlinearity.
- Computer use on the isolated 8788 origin verified real V2 migration: Journey retained its existing experiment, chapter 3 and 25,450 parameters. Sandbox retained a separate empty notebook and received the exposed output pieces.
- Built Image → Flatten → Dense · 10 → Softmax → Digit guess in Sandbox. A direct Flatten → Digit guess attempt was rejected. Changing the final Dense to 32 disabled training and Blocky explained the mismatch. Restoring 10 enabled training; five browser epochs completed at 89.8% held-out accuracy with 7,850 parameters. Blocky then suggested a hidden Dense and ReLU. This is an observed run, not a promised score. Moving and zooming retained the trained predictions and tip.
- Reload retained V3 boards and notebooks. At 390 × 844 CSS pixels, Show me highlighted Softmax above the bubble, with the card explicitly saying “Needs 10 scores. Got 32.” Undo restored a valid network. Desktop PyTorch view showed only Flatten and Linear(784, 10) as trainable-model operations and explained that prediction executes Softmax while CrossEntropyLoss trains on raw logits. No duplicate classifier or double softmax is exported. Physical touch hardware and a new Colab execution were not tested in this pass.
- Final verification: 31 Node tests, 14 Angular/ChromeHeadless tests, production build and Workers dry run pass. No deployment or changes to the user's active preview saves. Temporary test viewport and server were cleaned up.
- Screenshots: `docs/screenshots/explicit-output-blocks.png` and `docs/screenshots/softmax-width-mobile.png`.

## Follow-up: keep Blocky visible while panning (3 October 2026)

- Panning was included in the helper's suppression condition, which removed the character, bubble and highlight during each pan. Removed only that condition. Open explanations now stay open and target geometry continues following the viewport.
- An Angular regression holds the canvas in its active-panning state and verifies the character, expanded explanation, highlight and updated pointer coordinates. All 15 browser tests pass; production build passes. Computer use also panned with Why expanded and confirmed the visible clue and pointer remained attached. Evidence: `docs/screenshots/blocky-pan.png`.

## Independent levels and toolbar checking, 4 October 2026

The chapter navigation previously changed only the displayed history text while the entire Journey shared one board. It now selects a stable level ID with its own canvas, viewport, notebook and completion badge. Existing unlocks migrate without requiring another training run. The old single canvas is retained at the previously active era; old notebook entries are distributed by their recorded era. Old storage keys remain untouched for recovery.

- Computer use on the separate 127.0.0.1:8788 origin completed the first explicit network. The toolbar became yellow Check build, Blocky's arm and pointer aimed at it, and Show me focused the button without panning the canvas.
- Checking stayed on level one, recorded its badge, changed the action back to Train and exposed Next level. Level two opened with two loose endpoints. Adding a Tanh block, returning to level one, switching back and reloading retained the independent boards and their zooms.
- Optional five-pass training on level one completed at 90.0% held-out accuracy. Its single notebook entry survived level switching and reload; level two's notebook stayed empty. This is one observed run, not a guaranteed score.
- Keyboard port connections completed the second level with a hidden Dense and Tanh. At a 390 × 844 viewport, the yellow check action and Blocky pointer remained visible. Checking awarded level two, and Next level opened level three on fresh paper. The responsive override was reset afterward.
- 33 core tests and 18 Angular/ChromeHeadless tests pass. Coverage includes v1/v2/v3 migration, unchanged recovery copies, per-level reload, independent undo, completion without training, locked/busy navigation, Sandbox isolation and toolbar targeting.
- Production build and Workers dry run pass. The local preview remains running on port 8788. No deployment was made.
- Screenshots: `docs/screenshots/level-check-mobile.png` and `docs/screenshots/level-progress-desktop.png`.

Fresh paper now clears only the selected board and its notebook, preserving earned discoveries and all other levels. Training no longer advances completion automatically; the explicit build check records learning progress separately. Weights remain memory-only, so switching levels requires retraining for predictions.

## Blocky placement and dragging, 4 October 2026

Block dragging set `draft`, which was explicitly included in the helper's hidden-state condition. Removing that condition keeps the character and an expanded clue mounted while a block moves. The pointer follows draft geometry during the gesture. Blocky now sits 18 pixels from the canvas top and right, with its clue below; pointer origins follow the new arm position. Short windows place the clue alongside it. Removed the decorative paper captions and both Georgia font declarations, including the notebook's empty chart.

Production build and all 19 Angular tests pass, including a new regression that keeps the same character element and expanded explanation through a drag and checks moving-target coordinates. Computer use exercised dragging a connected prediction block with the clue open, undoing the move, and inspecting desktop and 390 × 844 layouts. Screenshot: `docs/screenshots/blocky-top-right.png`. The local preview remains on port 8788.

## Nearest-edge helper pointing, 4 October 2026

The helper previously targeted the fixed left-edge midpoint of every node. Node pointers now clamp to the nearest boundary of the highlighted outline from the pointing arm in screen coordinates, selecting a side or corner while following live drag positions, pan and zoom. Overlapping targets project to their nearest edge. Wire and toolbar targets retain their own targeting behavior. Show me centers the block using its center independently of the pointer endpoint.

All 36 core tests, 19 Angular tests and the production build pass. Added coverage for all four sides, all four corners, overlapping and touching rectangles, and scaled/panned geometry. Computer use confirmed the prediction block's top-right corner was targeted from diagonally above; dragging it alongside Blocky moved the endpoint to its right edge. The test move was undone. Screenshot: `docs/screenshots/blocky-nearest-corner.png`.

## Sidebar Sandbox entry, 4 October 2026

Sandbox is now an Always open entry above the Journey lessons in a shared sidebar list. The toolbar mode toggle is removed. Lesson links remain present in Sandbox and return directly to their saved Journey canvases, with exactly one current navigation item. The phone toolbar retains a compact current-level status in the freed space.

Production build and all 20 Angular tests pass. The navigation regression checks Sandbox access before any unlocks, locked lesson availability, active item semantics and independent board restoration. Computer use verified entering Sandbox, returning to a completed Journey canvas with its notebook intact, and the level list in the 390 × 844 phone drawer. Screenshot: `docs/screenshots/sidebar-sandbox.png`.

## Per-level datasets (4 October 2026)

- `npm run test:core`: 39 passing tests. New coverage checks Fashion-MNIST asset hashes, all ten class labels, old MNIST notebook provenance, level dataset assignments and matching Python/notebook exports.
- `npm test -- --watch=false --browsers=ChromeHeadless`: 24 passing tests. New cases cover dataset cache isolation, stale preview responses, immediate preview/model clearing, retry after failure, navigation, clothing export downloads and saved experiment dataset IDs.
- Production build passed without warnings. `npx wrangler deploy --dry-run` passed with 17 static assets. No deployment.
- In-app browser at `http://127.0.0.1:8788/`, separate from the user's localhost save: restored the existing completed level-2 network and trained Fashion-MNIST for five passes. Held-out accuracy was 80.0%, loss 0.592; example predictions showed Bag (94%) and Sandal (99%). This is one run, not a quality guarantee.
- Code view used `datasets.FashionMNIST`, the correct ten class names, and the same seeded 3,000/500 subsets. Export generation/blob tests passed; no external Colab job was run.
- Returned to level 1: MNIST image, drawing button and historical 90% MNIST notebook row restored; clothing predictions cleared. Stopped a digit training run after its first pass and confirmed no extra notebook entry.
- Level 3 opened its own loose endpoints with clothing images and no results. Sandbox restored its separate MNIST board. Reloading level 2 retained its clothing board, completion and result while clearing trained weights as expected.
- Used keyboard movement to arrange the test canvas. Verified sidebar dataset labels at phone width, drawer close and Fit all. Actual measured narrow DOM viewport was 433px with `scrollWidth === innerWidth`, so no horizontal document overflow. Restored the desktop viewport. No browser console errors observed.
- Screenshot: `docs/screenshots/dataset-level.jpg`. The screenshot is after reload, so the purple block correctly waits for retraining.
