# Local validation, 3 October 2026

Validated the production Angular build through `wrangler dev` on localhost:8787, using Codex computer use in the in-app browser. This is local evidence, not production deployment or physical-device verification.

## Observed flows

- Fresh lesson starts at 1958 with only Linear available. Later chapters are locked.
- Adding a 32-neuron dense layer creates 25,450 trainable parameters.
- Five passes over the real MNIST training subset completed; the first linear experiment scored 91.4% on 500 held-out examples and unlocked 1986.
- Selecting sigmoid, training again, and evaluating scored 89.8% and unlocked 2010/ReLU.
- A 64 ReLU → 32 ReLU network trained and evaluated at 90.2%; a repeat run reached 93.2%. Individual test predictions changed when Next digit was pressed (including a correctly predicted 6).
- Results are examples from this run, not guaranteed scores. A deeper network did not automatically win.
- Changing blocks cleared predictions and requested retraining. Neuron and activation selections matched the actual network after the dropdown fix.
- Reordering via both the Move buttons and an actual pointer drag retained the corresponding layer configuration. Dragging 64 → 32 into 32 → 64 updated the parameter count from 52,650 to 27,882. Removing a block worked. Adding a third block disabled the add button.
- Stop training returned control to the editor without adding a completed experiment or advancing the lesson.
- Optional hints expanded to explain dense layers, activations, epochs and the selected activation formula.
- Reload preserved the blocks, notebook and unlocks, while predictions correctly required retraining.
- A deliberately unavailable test asset produced a visible error and Retry button on a fresh local origin. Restoring the asset and clicking Retry loaded the digit and re-enabled Next digit.
- Start over displays a confirmation. Keep exploring preserves progress. Restart lesson cleared blocks, notebook and unlocks; the fresh 1958 state persisted after reload. The local preview was left in this fresh state.
- Visual inspection at 1440 × 1000 and 390 × 844 confirmed responsive layouts. At 390 px, document width equaled viewport width with no horizontal overflow.
- No console errors were observed in normal training. The intentionally missing asset generated the expected failed request in the separate recovery test.

## Automated checks

- Six Node tests cover parameter dimensions, unlock conditions, all local dataset records, invalid records, corrupt progress, locked/oversized restored networks and unavailable storage.
- Four Angular/ChromeHeadless tests cover app creation/title, select-value synchronization across unlocks, and disabling edits/layer limits during training.
- Production build passes. TensorFlow loads lazily: initial transfer estimate about 79 KB, training runtime about 196 KB, plus the approximately 570 KB compressed dataset.
- `wrangler deploy --dry-run` passes. No Cloudflare account resources or DNS changes were made.
- `npm audit --omit=dev` reports zero vulnerabilities. The full development tree still reports advisories rooted in `braces` and `http-cache-semantics`; their latest registry releases have no patched versions at the time of this check. They are not shipped in the static app. The compatible Piscina 5.3.2 override removes the build-tool critical advisory. Revisit these overrides and advisories during a future toolchain upgrade.

## Fixes found during validation

The first native select implementation bound its value before Angular rendered its options, so the visible neuron count could fall back to 16 while the model held 32. `ngModel` now keeps the select and model aligned, with a regression test. Editing blocks also clears the previous learning curve so it cannot be mistaken for a run of the modified network.

The original app was a draggable canvas prototype with no model execution. Its AWS-specific hosting scaffolding has been replaced by Workers Static Assets; real training is implemented entirely in the browser. This work did not diagnose why the former AWS deployment stopped serving.

## Deliberate limits

Three history chapters, dense layers only, one fixed small dataset, fixed training settings, and in-memory model weights. Pointer drag and accessible button-based reordering were exercised. Physical touch devices still need cross-device testing. CPU-only training speed was not benchmarked. Future chapters, custom drawing, model export, accounts and cross-device synchronization are not included.

## Screenshots

The completed experiment is captured in [desktop](docs/screenshots/learning-lab-desktop.jpg) and [mobile](docs/screenshots/learning-lab-mobile.jpg) views. The visible local preview is reset to the first lesson.
