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

1. Add a dense block and train. A single linear hidden layer explores weighted connections, with historical context from Rosenblatt’s 1958 perceptron.
2. Finishing that experiment unlocks the 1986 backpropagation chapter and sigmoid/tanh activations. Change the activation and train again.
3. That experiment unlocks the 2010 ReLU milestone. Stack up to three hidden layers, change their width, drag to reorder, or use the accessible Move buttons.
4. Compare test accuracy and loss in the notebook. Inspect individual unseen digits and the model’s output probabilities. Hints are optional.

The dates refer to influential papers, not exclusive invention claims. The lab consistently uses modern Adam optimization and softmax classification; it is not a historical implementation of the perceptron. Source links are embedded in each chapter. Later architectures and datasets remain future work.

## What actually runs

TensorFlow.js loads only when training starts. It builds a fresh model from the visible blocks and trains for five epochs on 3,000 images, then evaluates on 500 images drawn separately from MNIST’s official test split. No model or digit data is uploaded. WebGL runs when available, with TensorFlow’s CPU fallback. Training speed depends on the device.

Input pixels are normalized to [0, 1], hidden layers have 16, 32, 64, or 128 neurons, and the fixed ten-neuron output uses softmax. Adam uses a learning rate of 0.003 with batches of 64 and categorical cross-entropy. Initial weights use fixed seeds; shuffled training order still produces variation. The small test set is for exploration, not a benchmark. Repeatedly tuning against it can overfit the evaluation.

Blocks, unlocks, and the last eight experiments are saved in localStorage. Trained weights are kept in memory only. Changing blocks invalidates predictions; reloading requires training again. Storage failures do not block the lesson.

## Project structure

- `src/app/learning/curriculum.ts`: historical chapters, activation catalog, unlock rules and parameter counts.
- `src/app/learning/network-editor/`: accessible block editor and drag reordering.
- `src/app/learning/training.service.ts`: model lifecycle, cancellation, progress, evaluation and inference.
- `src/app/learning/mnist.ts`: validated binary dataset loading.
- `src/app/learning/progress.ts`: versioned, validated local progress.
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
