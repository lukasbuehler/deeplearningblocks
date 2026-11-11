# Deep Learning Blocks

A small browser-based learning lab. Build a dense neural network, optionally train it on real digits or clothing, and unlock ideas from neural-network history by experimenting.

## Run locally

Use Node 22.12+ or Node 24 LTS and npm.

```sh
npm ci
npm start
```

Open http://localhost:4200. To test the production build on the local Cloudflare Workers runtime:

```sh
npm run preview:worker
```

Open the localhost URL printed by Wrangler (normally http://localhost:8787). The production build serves the introduction at `/` and the playground at `/play`. The Angular development server opens the playground directly.

## First lesson

1. Open **+ Blocks**, add Flatten, Dense · 10 and Softmax, then connect Image → Flatten → Dense · 10 → Softmax → Digit guess. You can also tap a tile to add it and tap an output followed by an input to connect.
2. The top-right button becomes yellow **Check build** when the level objective is met. Blocky points to it. Check to save your discovery and unlock Sigmoid and Tanh. Training is optional.
3. Choose **Next level** to start a separate canvas for the 1986 clothing challenge (Fashion-MNIST). Build a hidden Dense with Sigmoid or Tanh before Dense · 10. Check that build to unlock ReLU and the 2010 level. Earlier canvases remain accessible in the guide.
4. Keep Fashion-MNIST for a comparison: try two hidden Dense layers with ReLU before Dense · 10 and check the final build. Optionally train for five passes, compare experiments in the bottom notebook, and inspect predictions inside the purple classifier. Up to six hidden Dense layers plus the 10-neuron output layer can be connected.

Drag the paper to pan, scroll to zoom, or use the zoom and Fit all controls. Compatible nearby studs snap together within 24 screen pixels. Blocks stay connected when moved apart. Select a block to read its explanation in the optional guide. Delete removes its incident wires; Undo and Redo recover complete edits, including an entire drag.

Keyboard: Tab to a block or port. Enter selects ports; arrows move a focused block (Shift for larger steps). Delete/Backspace removes the selection. ⌘/Ctrl Z undoes, with Shift to redo. Escape clears the current gesture or selection. Inputs retain their native keyboard behavior.

**Sandbox** has every implemented block unlocked and its own board and notebook. Experiments there never advance Journey. A fresh board always has two disconnected endpoints.

The dates refer to influential papers, not exclusive invention claims. The lab consistently uses modern Adam optimization and softmax classification; it is not a historical implementation of the perceptron. Source links are embedded in each chapter. MNIST supplies the first level and Sandbox; Fashion-MNIST supplies levels 2 and 3. CIFAR-10 is reserved for a later CNN level.

## What actually runs

TensorFlow.js loads only when training starts. It compiles the connected image-to-classifier path into a fresh model and trains for five epochs on 3,000 images, then evaluates on 500 images drawn separately from the selected dataset’s official test split. No model or image data is uploaded. On configured HTTPS deployments, PostHog receives limited usage events such as level completion and training outcomes; see [the event contract](DEPLOYMENT.md#event-contract). WebGL runs when available, with TensorFlow’s CPU fallback. Training speed depends on the device.

Input pixels are normalized to [0, 1], Dense layers offer 10, 16, 32, 64 or 128 neurons. The final score vector must contain 10 values for the separate Softmax block. The purple output block displays class probabilities and adds no trainable parameters. Adam uses a learning rate of 0.003 with batches of 64 and categorical cross-entropy. Initial weights use fixed seeds; shuffled training order still produces variation. The small test set is for exploration, not a benchmark. Repeatedly tuning against it can overfit the evaluation.

Each Journey level has a stable ID and its own positioned blocks, wires, viewport, completion badge and last eight experiments. Sandbox has a separate workspace. Saves use `dlb-playground-v4` localStorage. V3 migration preserves the existing shared canvas in the previously active era, distributes notebook entries by their recorded era, and preserves earned unlocks. Earlier canvases cannot be reconstructed from the old single-board save, so those start with loose endpoints and retain their badges. The old `dlb-playground-v3` key remains untouched for recovery. V2 and `dlb-lab-v1` migration are also supported. Undo histories are separate per level for the current session. Fresh paper clears only the selected canvas and notebook; earned discoveries remain. Trained weights stay in memory, so switching workspaces or reloading requires retraining. Moving, zooming, and editing unused blocks preserves predictions. Level and mode switching are disabled during training. Storage failures do not block play.

## Project structure

- `src/app/playground/graph.ts`: block definitions, typed ports, shape inference, graph validation, path compilation and unlock rules.
- `src/app/playground/geometry.ts`: viewport transforms, wires and snapping, independent of lesson state.
- `src/app/playground/history.ts` and `storage.ts`: undo/redo snapshots, validated versioned saves and legacy migration.
- `src/app/playground/game.service.ts`: mode isolation, training coordination, invalidation and progression.
- `src/app/playground/paper-canvas/`: CDK free dragging, SVG wires, connection gestures and toy box.
- `src/app/playground/block-card/` and `experiment-notebook/`: accessible HTML controls, predictions and results.
- `src/app/playground/model-builder.ts`: explicit TensorFlow Flatten, Dense, Activation and softmax layers.
- `src/app/learning/`: historical source notes, model lifecycle, cancellation, inference and validated dataset loading. `progress.ts` remains the legacy reader.
- `public/data/`: deterministic, locally served MNIST subset (about 570 KB compressed).

The old canvas prototype and Amplify scaffolding are preserved in Git history. This app needs no AWS resources, server-side rendering, accounts, database, or remote training service.

## Dataset provenance

MNIST is by Yann LeCun, Corinna Cortes and Christopher J. C. Burges, derived from NIST handwritten digits. See [the original dataset page](https://yann.lecun.org/exdb/mnist/index.html). Source files come from Google’s public `cvdf-datasets/mnist` mirror. `scripts/prepare-mnist.py` validates the canonical source MD5 checksums and samples without replacement using seed 1958. The train and test subsets stay in their original splits. The manifest records counts and SHA-256 checksums for the committed compressed assets.

```sh
python3 scripts/prepare-mnist.py
```

Each decompressed record is one label byte followed by 784 grayscale pixel bytes. The browser requires `DecompressionStream` (current Chrome, Safari, Edge and Firefox).

## Checks

```sh
npm run test:core
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
npx wrangler deploy --dry-run
```

`npm run format` formats source files. Local computer-use test results are recorded in `LOCAL_TESTING.md`.

## Cloudflare Workers

The deployment-ready setup and PostHog EU configuration are documented in [DEPLOYMENT.md](DEPLOYMENT.md). Run `npm run deploy:check` to build and dry-run without publishing. GitHub Checks validates pull requests and main without deploying.

The build produces a static Angular SPA. `wrangler.jsonc` serves `dist/deeplearningblocks/browser` through Workers Static Assets with SPA fallback. This follows [Cloudflare’s SPA hosting configuration](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). No Worker script is needed until the app gains server-side behavior.

After reviewing locally, authenticate to your intended Cloudflare account and deploy:

```sh
npx wrangler login
npm run deploy
```

Then attach the existing domain as a Custom Domain in the Worker’s Domains & Routes settings. Confirm the zone and any existing DNS records before changing them. No domain or account identifiers are hard-coded. Local preview and dry-run validation do not publish the app or modify DNS.

## Drawing and shape guidance

Choose **Draw your own** inside the yellow image block. White ink is cropped, scaled into a 20-pixel box and centered by its mass on a 28 × 28 black image. The pad previews that normalized input before submission. A trained model predicts immediately; otherwise the drawing waits until training completes. **MNIST digits** returns to dataset samples. Drawings and weights stay in memory and are never added to the training set or held-out evaluation.

Ports distinguish images, vectors and probabilities. Round pink probability connectors fit the display. Flatten advertises its fixed 784-number output even while disconnected; Dense advertises its configured width; Activation preserves the incoming width. Unknown vector widths use N. Flatten is needed at the image-to-vector boundary, not after every Dense layer.

Completed connections use an obstacle-aware orthogonal router with rounded corners. It routes around card bounds and follows moved blocks. Physically overlapping cards can still cover a port; separating the cards exposes it again.

## Blocky and the learning roadmap

The candidate architecture levels and construction-first completion rules are in [LEVELS.md](LEVELS.md). Training is an optional, per-level experiment.

The long-term learning path, small-game concept inventory, Blocky’s pointing/highlighting behavior, separate activation blocks, SVG icon refresh, group blocks, browser GPU feasibility and the Shakespeare transformer capstone are recorded in [ROADMAP.md](ROADMAP.md).

**Blocky** is a yellow block with two red connector arms. The optional helper points at a relevant block or wire, gives one short clue, and offers **Why?**, **Show me**, dismissal and mute. Asking Blocky again restores a dismissed clue; clicking the muted character unmutes it. Mute and configuration-specific dismissals are saved locally in `dlb-blocky-v1`. Moving or zooming does not reset a dismissal. Blocky lives at the top right of the canvas, with clues opening below. It stays visible during panning and block dragging, with its pointer following the moving target. It hides during wiring, training, drawing and tray interactions. Its rules are local and deterministic, with no LLM or remote service. After a successful training run, Blocky suggests one controlled experiment based on the connected architecture: a hidden layer, a nonlinear activation, ReLU, a width change, or inspecting mistakes. Tips never promise higher accuracy and explain the risk of repeatedly tuning on the small test set.

Linear, Sigmoid, Tanh and ReLU have distinct names and curve icons on the paper, without an activation dropdown. They retain the existing saved operation format. `block-catalog.ts` owns the tray identities, `blocky-hints.ts` owns pure advice rules, the canvas resolves target geometry, and the Blocky component owns presentation and preferences.

The three existing chapters are now separate saved levels. Construction checks record completion independently of experiments and keep the current canvas open. Next level explicitly opens new paper, and selecting an earlier chapter restores its work. Training records an experiment only; it does not complete a level. Sandbox cannot advance Journey. Stable level IDs and objectives live in `levels.ts`; exploration games, additional datasets, grouping and transformers remain roadmap work.

## From blocks to PyTorch

Open **PyTorch** in the toolbar (**Code** on smaller screens). **My model** shows the active connected chain as `nn.Sequential`; **Full recipe** includes MNIST loading, five Adam training passes and held-out evaluation. Copy either view, download a runnable `.py` script, or download a `.ipynb` notebook and open it in [Google Colab](https://colab.research.google.com/) with **File → Upload notebook**. The app does not upload files to Google.

Both downloads use fresh PyTorch weights and the exact seeded 3,000/500 MNIST subset used in the browser. They export architecture and the training recipe, not trained TensorFlow weights, drawings, progress or experiment history. Scores can differ between runtimes. The first Python run downloads MNIST through torchvision; install `torch` and `torchvision` as described at the top of the script.

The pure generator in `pytorch-export.ts` consumes the graph compiler's `NetworkSpec`, so execution order follows connections and unused blocks are excluded. Dense maps to `nn.Linear`; Linear activation maps to `nn.Identity`. The explicit Dense · 10 emits logits for [PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html); the prediction step executes the board’s Softmax. It is intentionally omitted from the training model because CrossEntropyLoss consumes logits. Digit guess adds no Python layer. Script and notebook share the same code sections. Exporting does not edit the board or change training state.

The product name remains **Deep Learning Blocks**. Its reusable brand component keeps the colorful, tactile lettering of the playground.

Sandbox lives at the top of the sidebar level list as an **Always open** entry. The level list remains visible inside Sandbox, so selecting any unlocked lesson returns to its saved Journey canvas. Switching workspaces remains disabled while training. The toolbar shows the current level or Sandbox as a status label.

## Dataset-aware levels

Dataset metadata lives in `src/app/learning/datasets.ts`, with level assignments in `levels.ts`. The input, class labels, block tray, helper language, notebook and Python/Colab recipes follow the active dataset. Drawing is available for MNIST only. Cached downloads are keyed by dataset and split; changing levels clears predictions and ignores stale preview responses. Failed downloads can be retried.

Existing boards, completions and notebooks remain intact. Notebook rows without a dataset field are historical MNIST results, even on a level that now uses Fashion-MNIST. They keep that label and are excluded from the clothing level's latest score. New rows save their dataset ID. The v4 storage shape stays compatible.

See [dataset attribution and reproduction](public/data/README.md). Both current datasets use 28 × 28 grayscale input and ten classes. Color, sequence and other input shapes require separate graph/runtime work; the registry does not imply those are already supported.
