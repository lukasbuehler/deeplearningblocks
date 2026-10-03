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
