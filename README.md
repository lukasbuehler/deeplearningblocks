# Deep Learning Blocks

A small browser-based learning lab. Build a dense neural network, train it on real MNIST digits, and unlock ideas from neural-network history by experimenting.

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

Open the localhost URL printed by Wrangler (normally http://localhost:8787).

## First lesson

1. Open **+ Blocks**, drag Flatten and Dense onto the paper, then connect Image → Flatten → Dense → Digit guess. You can also tap a tile to add it and tap an output followed by an input to connect.
2. Train for five passes to unlock the 1986 chapter, Sigmoid and Tanh.
3. Select a wire or occupied port, choose Disconnect, and insert an activation. Train with Sigmoid or Tanh to unlock ReLU and the 2010 chapter.
4. Try a second Dense layer, compare experiments in the bottom notebook, and inspect predictions inside the purple classifier. Up to six Dense layers can be connected.

Drag the paper to pan, scroll to zoom, or use the zoom and Fit all controls. Compatible nearby studs snap together within 24 screen pixels. Blocks stay connected when moved apart. Select a block to read its explanation in the optional guide. Delete removes its incident wires; Undo and Redo recover complete edits, including an entire drag.

Keyboard: Tab to a block or port. Enter selects ports; arrows move a focused block (Shift for larger steps). Delete/Backspace removes the selection. ⌘/Ctrl Z undoes, with Shift to redo. Escape clears the current gesture or selection. Inputs retain their native keyboard behavior.

**Sandbox** has every implemented block unlocked and its own board and notebook. Experiments there never advance Journey. A fresh board always has two disconnected endpoints.

The dates refer to influential papers, not exclusive invention claims. The lab consistently uses modern Adam optimization and softmax classification; it is not a historical implementation of the perceptron. Source links are embedded in each chapter. Later architectures and datasets remain future work.

## What actually runs

TensorFlow.js loads only when training starts. It compiles the connected image-to-classifier path into a fresh model and trains for five epochs on 3,000 images, then evaluates on 500 images drawn separately from MNIST’s official test split. No model or digit data is uploaded. WebGL runs when available, with TensorFlow’s CPU fallback. Training speed depends on the device.

Input pixels are normalized to [0, 1], hidden layers have 16, 32, 64, or 128 neurons, and the fixed ten-neuron output uses softmax. Adam uses a learning rate of 0.003 with batches of 64 and categorical cross-entropy. Initial weights use fixed seeds; shuffled training order still produces variation. The small test set is for exploration, not a benchmark. Repeatedly tuning against it can overfit the evaluation.

Positioned blocks, explicit wires, viewport, unlocks, and the last eight experiments per mode are saved in `dlb-playground-v2` localStorage. Legacy `dlb-lab-v1` networks migrate to connected boards with separate activation blocks; that key remains untouched as a recovery copy. Trained weights stay in memory. Changing the active computation invalidates predictions; moving, zooming, and editing unused blocks preserves them. Reloading requires retraining. During training, layout and viewing remain available while computational edits are disabled. Storage failures do not block the lesson.

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

The build produces a static Angular SPA. `wrangler.jsonc` serves `dist/deeplearningblocks/browser` through Workers Static Assets with SPA fallback. This follows [Cloudflare’s SPA hosting configuration](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). No Worker script is needed until the app gains server-side behavior.

After reviewing locally, authenticate to your intended Cloudflare account and deploy:

```sh
npx wrangler login
npm run deploy
```

Then attach the existing domain as a Custom Domain in the Worker’s Domains & Routes settings. Confirm the zone and any existing DNS records before changing them. No domain or account identifiers are hard-coded. Local preview and dry-run validation do not publish the app or modify DNS.

## Drawing and shape guidance

Choose **Draw your own** inside the yellow image block. White ink is cropped, scaled into a 20-pixel box and centered by its mass on a 28 × 28 black image. The pad previews that normalized input before submission. A trained model predicts immediately; otherwise the drawing waits until training completes. **MNIST digits** returns to dataset samples. Drawings and weights stay in memory and are never added to the training set or held-out evaluation.

Ports distinguish image tensors from vectors. Flatten advertises its fixed 784-number output even while disconnected; Dense advertises its configured width; Activation preserves the incoming width. Unknown vector widths use N. Flatten is needed at the image-to-vector boundary, not after every Dense layer.

Completed connections use an obstacle-aware orthogonal router with rounded corners. It routes around card bounds and follows moved blocks. Physically overlapping cards can still cover a port; separating the cards exposes it again.

## Learning roadmap and Pip

The long-term learning path, small-game concept inventory, Pip's pointing/highlighting behavior, separate activation blocks, SVG icon refresh, group blocks, browser GPU feasibility and the Shakespeare transformer capstone are recorded in [ROADMAP.md](ROADMAP.md).

Pip is the working helper name. Dot and Nori have been rejected. The helper remains a deterministic, optional proposal; it is not implemented yet. The recommended next implementation is dedicated activation blocks and consistent icons, followed by a small Pip pass. The roadmap preserves the current playground while introducing new concepts one small game at a time.

## From blocks to PyTorch

Open **PyTorch** in the toolbar (**Code** on smaller screens). **My model** shows the active connected chain as `nn.Sequential`; **Full recipe** includes MNIST loading, five Adam training passes and held-out evaluation. Copy either view, download a runnable `.py` script, or download a `.ipynb` notebook and open it in [Google Colab](https://colab.research.google.com/) with **File → Upload notebook**. The app does not upload files to Google.

Both downloads use fresh PyTorch weights and the exact seeded 3,000/500 MNIST subset used in the browser. They export architecture and the training recipe, not trained TensorFlow weights, drawings, progress or experiment history. Scores can differ between runtimes. The first Python run downloads MNIST through torchvision; install `torch` and `torchvision` as described at the top of the script.

The pure generator in `pytorch-export.ts` consumes the graph compiler's `NetworkSpec`, so execution order follows connections and unused blocks are excluded. Dense maps to `nn.Linear`; Linear activation maps to `nn.Identity`. The ten-way classifier emits logits for [PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html); the prediction step applies softmax. Script and notebook share the same code sections. Exporting does not edit the board or change training state.

The product name remains **Deep Learning Blocks**. Its reusable brand component keeps the colorful, tactile lettering of the playground.
