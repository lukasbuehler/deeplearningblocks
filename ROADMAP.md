# Deep Learning Blocks: from first connections to a tiny transformer

Planning snapshot: 3 October 2026. This is a staged product and learning roadmap, not a claim that the planned features exist. Ship one small, complete learning experience at a time. Dates below describe historical milestones, not delivery deadlines.

## Product direction

A colorful construction game where people discover how neural networks work by making, breaking, comparing and repairing them. Keep the cream paper, saturated block colors, chunky letters, physical connectors and visible data shapes. The name is **Deep Learning Blocks**.

MNIST is one level in a collection of architecture-building games. The long-term destination includes a character-level Shakespeare transformer that the player assembles and understands. Training is an optional experiment, offered locally only where supported and through export where appropriate. Players must be able to complete the level without training. See [LEVELS.md](LEVELS.md) for the proposed levels, completion rules and execution modes.

Keep these distinctions visible:

- Journey introduces concepts gradually; Sandbox exposes the implemented tools without advancing Journey.
- An interactive illustration, a real training run, and a supplied trained model must be labeled accurately.
- Level completion rewards a valid construction and a small exploration that demonstrates the central idea. It never requires training, an accuracy score, a GPU or a Colab account. Experiment checkpoints and level-completion badges are separate concepts.
- History supplies context and people, not a reason to mislabel modern implementations as their original historical algorithms.
- Browser training stays local and is enabled per level/configuration, not assumed for every architecture. Supplied compatible models, tiny numerical demonstrations and labeled reference traces offer other exploration routes. PyTorch/Colab remains an optional route for supported exports.

### What exists today

Angular playground, positioned blocks and routed wires, a single connected trainable chain, shapes and parameter counts, independent Journey/Sandbox saves, undo/redo, three historical chapters, MNIST browser training, a handwritten-digit pad, and Python/notebook export. The runtime registers TensorFlow.js WebGL and CPU backends. Activations have dedicated names and curve icons. Blocky offers deterministic clues and targeted highlights. Check my build unlocks the existing chapters without requiring training. Grouping, general branching, transformers, hardware preflight and the general level engine remain future work.

## Blocky: a helper with somewhere to point

**Chosen name: Blocky.** A yellow block with two red connector arms, expressive eyes and a thick black outline. The arms point toward highlighted blocks or connections. Earlier names are retired.

Implemented first slice: missing-piece and incomplete-path clues, rejected-connection explanations, current chapter clues and optional advice about linear stacks in Sandbox. Manual clues, Show me, Why, dismiss and persistent mute are available. The SVG character uses static poses with no animation, including under reduced-motion preferences. The behavior below remains the broader design target, including future chart, port and group targets.

### Behavior

- Blocky points at an actual block, port, wire, tensor badge or training chart. A speech bubble identifies the thing: “This Flatten turns the picture into 784 numbers.”
- Highlight the target with a contrasting outline or double stroke. For wires, draw an overlay of the existing routed path. Do not change computational graph colors or rely on color alone.
- Keep highlights attached through pan, zoom, resize and group expansion. Reference stable IDs, not stored screen coordinates. Resolve geometry through the canvas view layer.
- If the target is off screen, offer **Show me**. Do not unexpectedly pan or zoom the board. If it was deleted or the advice is no longer true, withdraw the hint.
- One short thought at a time. Offer **Why?**, **Got it**, **Not now** and **Mute Blocky**. The small Blocky button provides an obvious way to unmute or ask for a hint.
- Do not interrupt a drag, drawing stroke, connection gesture or active text input. Avoid covering ports, buttons and the finger's working area, especially on phones.
- Reduced motion uses a still pose and outline. No mandatory speech, blinking, bouncing or sound. Keyboard users can request the same explanations and move focus to a named target through Show me.
- Muting silences the mascot and its proactive highlighting, not necessary inline validation or training errors. Remember mute and dismissals across reloads.
- Blocky never changes the model, replaces a block or performs an experiment automatically.

### First deterministic rules

| Situation | Blocky's invitation | Important qualification |
| --- | --- | --- |
| Image connected toward a vector input | “This block needs a list. Flatten can unfold the picture.” | Point at the incompatible socket and its shape badge. |
| Train attempted with a gap | “These two ends aren't talking yet.” | Show a specific missing link, not a generic lecture. |
| Player tries Flatten after Dense | “You already have a list here.” | Flatten belongs at the image-to-vector boundary in this dataset. |
| Several Dense layers with no nonlinear activation between them | “Want to try a bend between these layers?” | This can be intentional. Suppress in the first linear-baseline lesson. Never demand an activation after every Dense. |
| Consecutive ReLU blocks | “The second ReLU won't change these numbers again.” | Do not generalize this equivalence to every activation function. |
| A loose block seems to be part of an experiment | “This one is still on the sidelines.” | Loose blocks are allowed. Explain exclusion only when relevant. |
| Training loss improves while validation loss worsens over several checks | “Practice is improving. New examples aren't. Want to compare?” | A tentative observation, not an overfitting diagnosis from one noisy point or model size. |
| Later attention head dimensions disagree | “Each head needs the same number of features.” | Point at the exact dimensions and explain divisibility. |

Implement a pure rule engine that consumes graph analysis, lesson state, experiment summaries and recent actions. Return a stable rule ID, priority, target reference and short copy. Keep rule evaluation, hint scheduling, target geometry and character rendering separate. Cooldowns and configuration-aware dismissal prevent repeating the same hint after every move. Validation remains authoritative; Blocky interprets it. No LLM or remote request is needed.

## Levels and how a lesson plays

The level catalog in [LEVELS.md](LEVELS.md) is the product structure. The concept inventory below supplies small games within those levels; it is not a requirement to make MNIST teach every subject. The current three chapters now accept construction checks without training and preserve earned unlocks. A future level engine must add stable lesson IDs and exploration evidence.

Target a few minutes of interaction per small game, with longer training optional. This is a design target, not a measured completion-time promise.

1. Give a tiny challenge with a concrete object or outcome.
2. Let the player make a guess or choose an experiment.
3. Let them manipulate the relevant thing directly.
4. Show the consequence with real values, examples or a clearly labeled illustration.
5. Offer one sentence explaining what happened and an optional history card.
6. Save completion from the construction/exploration, invite a comparison and unlock the next useful piece. Save training results separately if the player chose an experiment.

Prefer “move this boundary,” “sort these cards,” “compare these guesses,” and “repair this socket” to quizzes about vocabulary. Revisit the same concept at a larger scale. A correct connection is evidence of shape compatibility, not evidence that the player has learned every concept.

## Concept map and small-game ideas

This is the curriculum inventory. Rows are small games, not a requirement to build every mechanism simultaneously. Branches marked optional do not block the transformer path.

| Stage | Concepts to introduce | Small game | What the player discovers or earns |
| --- | --- | --- | --- |
| 1. Pictures become numbers | Example, label, feature, pixel, grayscale normalization | **Pixel postcards:** turn a few pixels on and inspect the numbers that travel out. | A picture is a grid of numbers; the label is the answer used for teaching. |
| 1 | Scalar, vector, matrix, tensor shape; batch as a stack of examples | **Pack the parcel:** match shape connectors; unfold a 28 × 28 picture into 784 numbers. Add a stack of postcards later. | Shape transformations preserve or deliberately rearrange data. Flatten does not learn. |
| 1 | Weights, bias, weighted sum, neuron, parameter | **Build a tiny sorter:** move two weights and a bias to separate colored points. | A learned rule consists of adjustable numbers, not a list of memorized labels. |
| 1 | Forward pass, class score, probability, prediction | **Guess before the machine:** distribute confidence tokens among candidate digits, then inspect the network's scores. | A prediction is a guess; confidence can be wrong. |
| 2. Making useful bends | Linear transformations and the limitation of stacking them | **The impossible fence:** try to separate XOR corners with a straight boundary. | Some patterns need a nonlinear transformation. |
| 2 | Sigmoid, Tanh, ReLU, identity; saturation and inactive ReLUs | **Bend the number line:** send draggable positive and negative values through each dedicated activation block. | Each activation has a distinct behavior and keeps the tensor shape. |
| 2 | Depth, width, representation, parameter count | **Same budget, different build:** compare a wide layer with a deeper arrangement. | More parameters or layers do not guarantee better predictions. |
| 3. What counts as wrong? | Accuracy versus loss | **Same score, different guesses:** compare two models with equal accuracy but different confidence on wrong answers. | Accuracy counts outcomes; loss can distinguish how confidently wrong a guess is. |
| 3 | Mean squared error and regression | **Land the dot:** predict a continuous value and feel how distance changes the penalty. | Squared error measures a numerical miss. This is a small regression side game, not a forced MNIST loss switch. |
| 3 | Categorical cross-entropy, logits and softmax | **Spend your confidence:** move probability tokens toward or away from the true class and watch its penalty. | Wrong, confident guesses cost more. Softmax distributes probabilities; cross-entropy measures the miss. |
| 3 | Binary cross-entropy, output/loss compatibility (optional) | **Two doors:** predict one of two labels with a probability dial. | Regression, binary and multiclass tasks need coherent output and loss choices. |
| 4. How learning happens | Gradient, gradient descent, learning rate | **Roll downhill:** choose step sizes on a simple loss landscape. | Tiny steps crawl; large steps can overshoot. Mark the landscape as an illustration. |
| 4 | Backpropagation and the chain rule, with optional equations | **Pass the adjustment back:** inspect how changing an early weight changes a later error. | Gradients tell each parameter how it contributed locally; they are not the predictions flowing backward. |
| 4 | Batch, training step, epoch, shuffle, seed | **Deal the postcards:** choose how many examples form a batch and watch a pass through the deck. | A step and a pass are different; ordering and randomness affect an experiment. |
| 4 | SGD, momentum, Adam | **Three little hikers:** compare update trails on the same small task. | Optimizers choose updates differently. Adam is already used in MNIST; now expose why. |
| 4 | Initialization, vanishing/exploding gradients, numerical stability | **Signal relay:** compare signal and gradient scales through several layers. | Saturation and unstable scales can make learning difficult. Gradient clipping is a later sequence lesson. |
| 5. Learning or memorizing? | Training, validation and test splits | **Three envelopes:** practice examples, a rehearsal set for tuning, and a sealed final check. | Only training examples update weights; repeatedly tuning to the final check makes it less independent. |
| 5 | Leakage and fair comparisons | **Spot the sneaky duplicate:** find an example copied into both practice and evaluation. | A high score can come from a flawed experiment. |
| 5 | Underfitting, overfitting, model capacity, noisy labels | **Memory champion:** train a small and a larger network on a deliberately limited set and compare curves. | Better practice scores do not always mean better generalization. No fixed accuracy gate. |
| 5 | Early stopping and saving the best validation checkpoint | **Stop at the sweet spot:** choose a checkpoint on already measured curves, then compare it. | The final training step need not be the best choice. |
| 5 | Dropout, weight decay, data augmentation | **Learn with fewer clues:** compare one intervention at a time. | Regularization changes learning; dropout behaves differently during training and inference. Transformations must preserve the label. |
| 5 | Class balance, confusion matrix, precision/recall (optional) | **The misleading scoreboard:** exploit an imbalanced toy dataset, then expose which labels are missed. | Accuracy alone can conceal poor performance on a class. |
| 6. Networks within networks | Group, exposed input/output, module interface, reuse | **Box your invention:** select Dense → ReLU, give it a name and reuse it. | Abstraction hides detail without hiding what goes in and out. |
| 6 | Independent parameters versus shared weights | **Twins or teammates?:** compare copied blocks with a deliberately shared operation. | Repeating the same structure normally creates new weights; reuse does not automatically mean weight sharing. |
| 6 | Branches, Add, Concatenate, residual connections | **Build a shortcut:** route information around a block and merge it. | Add needs matching shapes; concatenation joins along a named axis. |
| 7. Images, locally (optional branch) | Convolution, filters, feature maps, channels, receptive field | **Slide the stencil:** slide a small filter over handwritten strokes. | Local patterns can share the same learned detector across positions. |
| 7 | Stride, padding, pooling, CNN versus dense parameter budgets | **Keep the edges:** change border handling and downsampling, then compare a tiny CNN on MNIST. | Spatial structure matters. CNNs enrich the historical path but are not a prerequisite for attention. |
| 8. From pictures to text | Character token, vocabulary, encoding/decoding, unknown symbols | **Alphabet factory:** turn a short line into token IDs and back. | IDs name symbols; their numeric distance is not semantic similarity. Begin with characters before optional subword tokenization. |
| 8 | Next-token targets, context windows, sequence shape | **One character ahead:** slide an input ribbon against its one-position-shifted target. | Every position can supply a training example; future characters must not leak into its context. |
| 8 | Bigram baseline, probability sampling, temperature | **A tiny typewriter:** generate text from a very small baseline and vary sampling. | Generation samples a distribution. A fluent-looking snippet is not proof of understanding. |
| 8 | Embeddings and learned representations | **Give letters coordinates:** inspect and adjust a tiny lookup table, then let it learn. | Embeddings are learned vectors, not fixed rankings of letters. |
| 8 | Order and positional information | **Scrambled sentence:** compare the same tokens in different positions. | Token identity alone does not tell the model where it is. |
| 8 | Recurrent state, RNN and LSTM (optional history branch) | **Pass the memory parcel:** carry a small state along a token ribbon. | A historical alternative to attending over context. Teach unrolling rather than allowing arbitrary graph cycles. |
| 9. Attention | Dot product, similarity, query, key, value | **Who has the clue?:** match query cards to key cards, then collect their value cards. | Relevance scores determine a weighted mixture of values. The analogy has limits; show actual numbers on request. |
| 9 | Attention scores, scale, softmax axis, weighted sum | **Mix the clues:** adjust scores and watch weights and the resulting vector. | Attention is a specific computation, not a magic “understanding” block. |
| 9 | Causal mask and autoregressive prediction | **No peeking:** block future positions and inspect exactly which cells change. | Prediction at a position must not use its future answer. |
| 9 | Self-attention, multiple heads, head dimensions | **A team of spotters:** inspect separate heads, combine them and project back. | Heads can learn different patterns, but do not promise each has a neat human-assigned role. |
| 10. A transformer of your own | Layer normalization, residuals, position-wise feed-forward network, GELU | **Assemble a decoder room:** combine familiar subassemblies and open them to inspect shapes. | Attention, an MLP and stable skip paths work together. |
| 10 | Repeated decoder layers and independent parameters | **Build another floor:** duplicate a decoder module and compare depth versus cost. | Repeated structure is modular; each layer normally learns its own weights. |
| 10 | Character-level language modeling, token cross-entropy, perplexity | **Shakespeare's apprentice:** compare untrained output with clearly labeled supplied checkpoints; offer personal training as an optional experiment. | Lower held-out token loss reflects better prediction on that corpus, not general intelligence. Explain perplexity only after cross-entropy. |
| 10 | Generation loop, context truncation, temperature and optional top-k | **Direct the little theatre:** change a prompt and sampling settings while keeping the model fixed. | Sampling changes outputs without retraining. Inspect one generated character at a time. |
| 10 | Reproducibility, checkpoints and export | **Pack your laboratory:** save a model recipe, dataset identity, seed, settings and supported weights; continue elsewhere. | Separate a recipe from a trained checkpoint. Browser and Python results need not be bit-identical. |

### History without a misleading timeline

Keep the current 1958, 1986 and 2010 chapter completions as earned progress. Add stable lesson IDs and prerequisites instead of extending a single era counter into dozens of unrelated conditions. The expanded journey should broadly move from early neurons toward modern architectures, with prerequisite games and optional historical side paths. Do not reset existing unlocks when lessons are reorganized.

A strictly increasing date order conflicts with revisiting CNNs after a player has already met ReLU. Recommended treatment: a chronological history map plus a prerequisite-based learning path. Display the real date on the history card, including when a lesson revisits an earlier development. This ordering is a proposal to review, not a reason to silently rewrite history.

Retain the existing source notes for Rosenblatt (1958), the influential backpropagation demonstrations (1986), and the 2010 ReLU milestone. Later anchors include [attention in neural translation, 2014 preprint / 2015 conference](https://arxiv.org/abs/1409.0473), [residual learning, 2015 preprint / 2016 conference](https://arxiv.org/abs/1512.03385), [layer normalization, 2016](https://arxiv.org/abs/1607.06450), [GELU, 2016](https://arxiv.org/abs/1606.08415), and [the Transformer, 2017](https://arxiv.org/abs/1706.03762). These are cited milestones, not exclusive invention claims. Source any additional history cards before shipping them.

## First visible improvement: activation blocks and icons

Each activation becomes a distinct tray item and block identity: **Linear (identity)**, **Sigmoid**, **Tanh**, **ReLU**. Later add **GELU** when the transformer feed-forward module needs it. Leave less essential variants such as Leaky ReLU and SiLU for optional experiments. The generic activation dropdown disappears from the canvas.

Every activation tile has its own name, a large recognizable function curve, a one-line behavior description and a same-shape input/output contract. Keep the green activation family color, using curve and text to distinguish variants. Locked tiles show the actual prerequisite. Identity is explicitly an experiment tool, not something required after Dense.

Internally, reuse the activation operation and runtime implementation. Give catalog variants their own stable IDs and creation defaults. Existing version-2 nodes already store their chosen activation, so they can render as the corresponding dedicated block without changing their function or throwing away saved boards. Only bump storage schema if the final representation actually changes. A future explicit Swap action can preview a compatible replacement as one undoable computational edit; it must not reintroduce a hidden dropdown or silently alter blocks.

Replace decorative Unicode operation glyphs with a small, consistent set of local SVG illustrations. Prioritize the block tray, card headers, ports and toolbar; retain text labels and accessible names.

| Item | Proposed picture |
| --- | --- |
| Image | A little pixel postcard |
| Flatten | A square grid unfolding into a strip |
| Dense | Two small rows of dots with a few clear connecting lines |
| Each activation | Its actual function curve with small axes |
| Digit classifier | Ten labeled slots with one highlighted guess |
| Train / Stop | Clear play triangle / square |
| Undo / Redo | Matching curved arrows |
| Disconnect / Delete | Separated plugs / a small bin, with distinct labels |
| Group | A box containing smaller colored blocks |
| Attention, later | Token tiles connected to a selected token |

Use the same stroke weight, rounded corners and ink color throughout. Icons must remain readable at the smallest supported zoom and must not be the only way to identify an operation. Avoid replacing meaningful graph curves with generic decorative symbols.

Acceptance for this small pass: add each unlocked activation directly, read its curve and shape, connect/train/export it, delete/undo it, and reload an existing board without changing its computation. Check locked variants, touch targets and keyboard names. No new curriculum or training backend is necessary for this milestone.

## Groups, modules and branching

Build reuse in three steps so the player and implementation grow together.

1. **Local groups:** name and collapse an existing connected chain, with visible entry/exit ports. Expand or ungroup without changing parameters, computation or trained predictions. Grouping is a structural view operation, not a new learned layer.
2. **Reusable templates:** save a group in a personal tray and instantiate independent copies. Embed its definition in the saved board so reopening does not depend on an external template library. Treat instances as snapshots initially; editing one does not silently update others. Sharing weights is a later, explicit feature.
3. **General modules:** groups can contain directed acyclic graphs with named, typed ports. This supports residual paths, attention projections and repeated transformer modules. Groups cannot recursively contain themselves. Validate nesting and expanded node limits before compilation.

Give moving, grouping, ungrouping, instantiation and deletion clear undo boundaries. Deleting a group must say that its contained blocks and incident edges will be removed. Ungroup is a separate action. Keep nested targets addressable so Blocky can point into a group, offering to open it first.

The present graph has one edge per port and only a sequential active path. Transformers require a deliberate evolution: named input/output ports, controlled output fan-out, multiple named inputs, Add/Concatenate semantics, topological execution and shape checking across branches. Inputs still reject implicit replacement; graph cycles remain invalid. Start with one source and one selected prediction/loss path; defer multiple unrelated training objectives.

Preserve visual and computational identity separately. A collapsed or expanded representation must compile to the same canonical executable graph. Repeated instances receive distinct parameter namespaces. Flattening a module for runtime/export must preserve intended sharing only when sharing is explicitly enabled. Keep source-node mappings for errors and Blocky highlights.

## Browser training and device limits

### What is supported versus what must be proved

The current app imports WebGL and CPU TensorFlow.js backends and lets TensorFlow.js select one. WebGL can execute training operations on the GPU. Record and display `tf.getBackend()` after initialization rather than assuming that every device is using the GPU. No per-device backend measurement was performed for this planning pass. [TensorFlow.js platform guide](https://www.tensorflow.org/js/guide/platform_environment)

WebGPU offers a newer compute API, but browser availability and a successful adapter request do not prove that a model can train. TensorFlow.js's current WebGPU README explicitly cautions about missing gradient-related operations. Treat it as a benchmark candidate, not a drop-in promise. Evaluate the exact pinned backend version with every operation and gradient used by our model before enabling it. [TensorFlow.js WebGPU backend](https://github.com/tensorflow/tfjs/blob/master/tfjs-backend-webgpu/README.md)

There is no honest universal “maximum network size” for browser training. Device, browser, backend, dtype, batch size, context length, optimizer state, live activations and kernel implementations all matter. Run small bounded checks and report what they establish.

### Preflight and recovery

Proposed flow when a player first opens a more expensive lesson or materially enlarges its model:

1. Detect available backends and required capabilities. Try initialization, not just the presence of an API name.
2. Compile the actual model or a bounded representative shape, verify forward output, backward gradients and an optimizer update. A successful inference pass is insufficient.
3. Warm up, then time a short bounded training sample. Separate shader compilation from steady-state batch time. Dispose probe state and start the real lesson from its intended seed.
4. Estimate the chosen run from measured batch timing and a conservative memory model. Show a range and its uncertainty. Never allocate up to exhaustion merely to find the limit.
5. Offer **Recommended size**, **Smaller experiment**, or **Export to Colab**. For slow-but-supported runs, let the player explicitly try them. For unsupported operations or known-invalid limits, block only that run and keep the editor and illustrations available.
6. Handle out-of-memory, WebGL context loss, WebGPU device loss, background throttling and cancellation. Preserve the board and last completed checkpoint when available. Explain whether a retry restarts training. Do not silently change architecture or backend mid-experiment.

Run the probe in an isolated runner so it cannot discard an existing trained model. Switching the active TensorFlow.js backend requires a deliberate model/resource lifecycle; backend experiments must not silently clear predictions.

Suggested copy: “This model may take a while here. Try a shorter context or fewer layers.” If an operation fails: “This browser can't train this attention block with the current backend. You can still explore it or export your model.” Do not tell a player their entire device is unsupported merely because one run is slow.

WebGPU adapter limits describe permitted resource sizes, not a reliable total free-VRAM measurement; browsers may report tiered limits. Do not advertise exact available GPU memory from them. [GPUAdapter limits](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/limits)

Handle loss of the device even after a successful preflight. A recreated GPU device requires new resources, so resumption needs a real checkpoint rather than a surviving diagram alone. [GPUDevice lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost)

Move sustained training into a dedicated Web Worker where the selected runtime/backend is verified to work. Keep progress, cancellation and tensor ownership explicit. A Worker helps UI responsiveness; it does not make computation free. Avoid copying the entire text corpus every step and avoid synchronous GPU readbacks for per-batch UI updates. [TensorFlow.js Worker training example](https://www.tensorflow.org/js/tutorials/training/web_worker)

### Memory and run-size budgeting

As a rough planning baseline, retaining FP32 parameters, gradients and two Adam moment buffers accounts for about 16 bytes per parameter before activations, temporary tensors, copies and runtime overhead. This is not a peak-memory promise. A materialized FP32 attention-score tensor alone contains `batch × heads × context²` values. Doubling context quadruples that tensor's size. Actual peak memory depends on the implementation and saved backward intermediates.

Benchmark candidates for the transformer spike, not published supported-device tiers:

| Candidate | Decoder layers | Width | Heads | Context | Batch |
| --- | ---: | ---: | ---: | ---: | ---: |
| Smallest lesson | 1 | 32 | 2 | 32 | 4 |
| First full construction | 2 | 64 | 2 | 64 | 8 |
| Optional larger experiment | 4 | 128 | 4 | 128 | 8 |

Start with the smallest candidate. Set step/time limits and checkpoint intervals from measurements. Longer text and more parameters are later choices, not the definition of a completed lesson. Test low-powered phones, integrated-GPU laptops and desktop GPUs before claiming support. If WebGPU does not pass, retain verified WebGL where practical and offer export. Do not introduce a second training framework or custom kernels until a measured gap justifies the maintenance cost.

## The Shakespeare capstone

Use **Tiny Shakespeare** as a versioned local asset with provenance and a checksum. The commonly used character-level preparation has about 1.1 million characters and a vocabulary of 65 characters; derive the actual values from the pinned asset. The reference preparation uses a 90/10 train/validation split. Our learning product should define its own explicit train/validation/test policy. [nanoGPT character-data preparation](https://github.com/karpathy/nanoGPT/blob/master/data/shakespeare_char/prepare.py)

Split raw text into disjoint documents or contiguous regions before creating context windows. Do not randomly split overlapping windows or let windows cross split boundaries. Define the vocabulary policy explicitly: use a declared character alphabet or fit it on training text with unknown-character handling. Record the source revision, split strategy, preprocessing, vocabulary and seed in exported recipes. Resolve redistribution attribution before bundling the selected asset.

Build toward a small decoder-only character model. This is a later language-model adaptation, not a replica of the original 2017 encoder-decoder translation system. Begin with this readable shape:

```text
Character IDs + positions
          ↓
Token embeddings + positional embeddings
          ↓
Decoder module × N
  ├─ LayerNorm → causal self-attention → residual Add
  └─ LayerNorm → Dense → GELU → Dense → residual Add
          ↓
Final LayerNorm → vocabulary scores
          ↓
Next-character loss during training / sampling during generation
```

Inside each decoder module, the updates are sequential: `x = x + attention(LayerNorm(x))`, followed by `x = x + MLP(LayerNorm(x))`. This proposes a pre-normalized decoder design. The original Transformer paper supplies the attention foundation; exact architecture and normalization order must be documented with the implemented model rather than attributed wholesale to 2017. [Attention Is All You Need](https://arxiv.org/abs/1706.03762)

Introduce the attention block by opening its internals: projections for Q/K/V, head reshaping, scaled QKᵀ scores, causal masking, row-wise softmax, weighted values, head concatenation and output projection. Show `[batch, time, features]` and then `[batch, heads, time, head width]` when the player asks for detail. Validate that feature width divides by the head count and residual Add inputs agree. Dropout can be added after the minimal model is understood and its train/evaluation behavior is tested.

Reward assembling the transformer, inspecting attention and tracing a generation step. Completion never requires training or downloading a large checkpoint. Offer compatible supplied checkpoints or clearly labeled recorded reference traces; do not present their results as the player's own training. Local training is optional for validated configurations, with a matching PyTorch notebook where supported. A short optional run may still produce messy text; do not promise coherent Shakespeare after a few seconds. The attention picture is a view of weights, not a definitive explanation of the model's reasoning.

## Delivery milestones and dependencies

Each milestone gets a small scoped implementation plan, appropriate tests, computer-use verification and its own commit. This roadmap does not authorize deploying the app or starting every item at once.

| Milestone | Small deliverable | Dependencies | Ready to move on when |
| --- | --- | --- | --- |
| M1. Clearer block identities | Dedicated activation tiles/cards and consistent SVG icons | Existing registry and saves | Existing models retain their behavior, individual activations can be added/trained/exported, and keyboard/phone controls work. |
| M2. Blocky's first appearance | One character, manual Help, Mute and three targeted rules: shape mismatch, incomplete path, unnecessary Flatten | M1; stable target references | Blocky points correctly through pan/zoom, never obstructs a drag, handles deleted/offscreen targets, and stays quiet when muted. |
| M3. Levels and learning games | Construction-based completion, per-level execution modes, loss and learning mini-games | Stable lesson IDs and reusable activity shell | Levels can be completed without training or a GPU; build/exploration evidence is recorded separately from experiments; existing unlocks migrate intact. |
| M4. Fair experiments | Training/validation/test design, curves, limited-data overfitting game and checkpoint comparison | M3; experiment schema and configurable training settings | Evaluation data never updates weights, validation is used for tuning, and the final check is separated and accurately labeled. |
| M5. Group a useful pattern | Local chain groups, collapse/expand, ungroup, names and template copies | M1; canonical computational identity | Grouping preserves predictions and parameter totals; copies have independent parameters; saves and undo round-trip. |
| M6. Optional training feasibility | Worker spike, backend status, bounded preflight, tiny real attention forward/backward test, device benchmark table | Can begin as a limited research spike after M3, before committing to full attention UI | Record which configurations can train with finite gradients, stable memory and responsive cancellation. A no-go restricts local training only; it does not block construction levels or reference exploration. |
| M7. Branches and richer tensors | Named ports, fan-out, Add, Concatenate, rank-aware shapes and general modules | M5; M6 informs optional execution | Topological compilation, source-linked errors, save migration, parameter accounting and exports agree on branched models. |
| M8. Text playground | Character encoding, shifted targets, disjoint splits, bigram baseline, embeddings and sampling games | M3/M4; dataset abstraction and sequence tensors | Players assemble a text model and inspect next-token behavior using a compatible supplied example or tiny baseline; optional training preserves split isolation. |
| M9. Build attention | Q/K/V and mixing games, causal mask, one head then multiple heads | M7/M8; M6 only for optional local training | Causality, head reshaping, softmax axis and gradients match a reference implementation. Blocky can point at tokens, matrix cells and edges. |
| M10. Shakespeare workshop | Expandable decoder module, repeat instances, normalization, GELU, training/checkpoints and matching code export | M4/M5/M7/M8/M9; M6 only for optional local training | Players assemble a tiny transformer and inspect its components without a training requirement. Supported experiments and supplied checkpoints have honest labels and recovery behavior. |
| Optional image/history branch | Convolution and pooling games, tiny CNN; optional RNN/LSTM history path | Richer tensors and relevant runtime checks | The branch adds intuition without blocking the main transformer journey. |

**Progress:** M1 is implemented. M2 has its first deterministic clue and pointing slice; richer rule coverage remains incremental. Construction checks are implemented for the three existing chapters. **Recommended next implementation:** a small M3 level-engine slice with one exploration task, followed by the first loss game. Keep new datasets, backends and grouping in separate changes.

## Architecture guardrails

- **Block catalog versus operations:** display variants, icons, unlock metadata and hints belong in the catalog; shared mathematical operations belong in the compiler/runtime. Distinct activation blocks need not duplicate activation code.
- **Lesson engine:** stable lesson IDs, prerequisites, activity state, optional history sources and observable completion events. Keep rewards separate from training and runtime success/failure. Construction validation and a small exploration supply level-completion evidence; no training-complete event is required. Sandbox cannot emit Journey completion events.
- **Experiment recipe:** dataset/version/splits, preprocessing, graph signature, seed, optimizer, loss, batch size, run budget and backend. Notebook rows need this information for comparisons; label old rows as legacy experiments when the split protocol changes.
- **Execution contract:** graph compiler returns executable operations, full tensor shapes/dtypes, parameter counts and source mappings. Runtime adapters expose capabilities, training, evaluation, prediction, stop and eventually checkpoint import/export. Do not create multiple backend implementations before needed.
- **Tensor contracts:** add rank, axes, dtype and symbolic dimensions incrementally. Token IDs differ from floating-point features. Batch/time/feature conventions must be explicit, including browser versus PyTorch image layout differences.
- **Graph persistence:** introduce a new board version when named ports/branches/groups require it, with pure tested migrations from current saved boards. Preserve old saves as recovery copies. Group definitions, stable IDs and references must survive reloads without recursion or dangling edges.
- **Checkpoints:** separate optional large weights in IndexedDB from small board/progress state. Include architecture and dataset signatures plus optimizer state for a true training resume. Handle quotas and missing checkpoints. Today weights remain memory-only; this is future work.
- **Loss and optimizer controls:** begin in a training bench/panel with clear contracts. They are not ordinary feature-transform blocks in the forward path. If later drawn on paper, give supervision and optimization their own connection semantics.
- **Exports:** advance browser execution and PyTorch/notebook export together for every new supported operation. Reject unsupported exports explicitly. Groups become readable modules; tests check shapes, causal behavior, losses and parameter counts, not merely code strings.
- **No silent fixes:** incompatible ports explain the mismatch. Suggested smaller models are previews the user chooses. Blocky can help find an error but does not repair the graph uninvited.

## Verification gates

For each new game, verify it can be completed without training or a capable GPU. Test its learning claim with actual examples, not only its rendering. Review the wording for misconceptions and whether a player can complete it by doing something meaningful.

For new graph features, test valid and invalid shapes, input occupancy, cycles, disconnected components, grouping/ungrouping, copy versus sharing, undo, migration and computational signatures. Layout-only operations must keep predictions.

For training, test finite losses/gradients, a tiny-batch overfit sanity check, train/evaluation mode changes, split isolation, cancellation, resource disposal, restart/resume semantics and CPU/GPU tolerance where supported. Validate causal masking by changing future tokens and checking that earlier outputs do not change in evaluation mode.

For Blocky, test priority, cooldown, mute persistence, target deletion, offscreen targets, blocked gestures, keyboard navigation and reduced motion. Advice must not treat every unconventional architecture as invalid.

For the UI, exercise touch-sized controls with computer use at desktop and phone widths, then validate actual touch/GPU behavior on representative hardware before publishing device-support claims. Keep screenshots and measured runtime results with each milestone. A local dry run is not a live deployment or a guarantee of device support.

## Decisions to revisit at the appropriate milestone

- Refine Blocky’s yellow body and red pointing arms as the level catalog grows. The name is chosen.
- History-map presentation versus a strictly chronological unlock path. Recommended: accurate dates plus prerequisites, preserving earned progress.
- The exact MNIST validation subset and final-test policy. Current repeated access to the same 500 test digits is a teaching shortcut, not a pristine model-selection protocol.
- How much of the transformer is initially expanded. Recommended: build and inspect one attention module, then allow deliberate grouping and repetition.
- The browser/backend support matrix and capstone presets after measurements. Do not set a universal parameter ceiling or runtime promise now.
- Whether later weight sharing, custom datasets, subword tokenizers and larger models merit dedicated lessons. They are outside the first transformer milestone.
