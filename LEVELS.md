# Level ideas: a little museum you can build

Planning update: 3 October 2026. These are candidate levels, not implemented features. See [ROADMAP.md](ROADMAP.md) for shared systems and implementation milestones.

## The central change

**Build it, understand one important thing, unlock the next idea.** Training is an optional experiment, not the admission ticket to the next level. MNIST is one level in a much wider collection.

The 2017 attention level (Shakespeare's Workshop, below) now exists as an early end-to-end slice: a text board, the transformer blocks, shortcut wires into Add, browser training on Tiny Shakespeare and a live writer. The text and attention levels before it are still to come. The three picture chapters are implemented as independent saved levels with stable IDs, canvases, viewports, notebooks and completion badges. The yellow toolbar **Check build** action rewards construction without training. **Next level** opens a separate canvas; selecting an earlier level restores its work. Existing unlocks migrate intact. The first level uses MNIST digits; the next two use Fashion-MNIST clothing, first to introduce a hidden nonlinear layer, then to compare a deeper recipe on the same dataset. Sandbox retains MNIST. Each notebook result records its dataset; historical results remain labeled MNIST. The broader exploration engine and candidate levels below remain future work.

A good level introduces a distinct idea, has a satisfying construction task, and shows an understandable consequence. Changing only the dataset is not automatically a new level. Use familiar data where it makes the new idea easier to see.

## How a player earns completion

- Assemble a graph that meets the level's learning objective. Validate topology, tensor shapes and any concept-specific requirement, not the exact position of blocks or one prescribed arrangement.
- Perform one small exploration: trace a tensor, compare two outputs, inspect a feature map, fix a mask or explain a difference by manipulating an example. Avoid vocabulary quizzes and heavy computation gates.
- Award the completion badge immediately. Do not require a training job, an accuracy threshold, a GPU, a supplied model download or a Colab account.
- Make optional experiments visibly optional. Trying variants can fill an experiment scrapbook, but access to later concepts must not depend on device speed.

Examples: a CNN level checks that a spatial feature extractor feeds a compatible classifier, then asks the player to inspect a filter response. A residual level checks the bypass and matching Add inputs, then lets the player trace both routes. An attention level checks the causal mask and head dimensions, then asks the player to reveal which tokens a position can see.

The initial check should help players repair their model through specific highlights. Accept different valid solutions where the lesson permits them. Do not automatically complete a level just because any input is connected to any output.

## Candidate levels

The order below is a proposed learning progression, not an assertion that the architectures were invented in that order. Small introductory games are included even when they are not deep networks.

| Level | What you assemble | The playful challenge | The new idea | Suggested exploration |
| --- | --- | --- | --- | --- |
| **1. The Tiny Sorter** | One neuron / linear classifier on colored points | Help two kinds of creatures find their homes by moving a boundary. | Inputs, weights, bias and a decision. | Immediate arithmetic and a draggable boundary. No training needed. |
| **2. The Impossible Fence** | A tiny MLP on XOR-like points | The straight fence fails. Add a hidden layer and a nonlinear block to separate the corners. | Why hidden layers need useful nonlinearities. | Small authored parameter examples and live boundary visualization; optional tiny training experiment. |
| **3. Digit Detective** | The existing dense MNIST classifier | Build a digit reader, then challenge it with your handwriting. | Pixels, Flatten, Dense, activations, ten-way output. | Optional browser training remains a highlight. Construction and shape tracing earn the badge without it. |
| **4. Picture Post Office** | A small convolutional classifier on color images | Sort cats, cars and airplanes into picture mailboxes. Slide a filter over an image and inspect what it sees. | Convolution, channels, pooling and spatial features. | Small supplied reference model and feature-map exploration; no local training requirement. |
| **5. Picture Repair Shop** | A denoising autoencoder | Squeeze a noisy picture through a narrow tunnel and rebuild it on the other side. | Encoder, bottleneck, decoder and reconstruction loss. | Compare clean/noisy/reconstructed images with compatible supplied weights; optional small training recipe later. |
| **6. Shortcut City** | A small residual network module | Build a second route around a block, then reunite the signals without a shape collision. | Branching, residual Add and reusable modules. | Trace both paths and compare same-shaped tensors. Full ResNet training is unnecessary. |
| **7. Paint Every Pixel** | A miniature U-Net-style segmentation network | Color each pixel as shape or background, instead of giving the whole picture one label. Reconnect the detail shortcuts. | Dense prediction, downsampling, upsampling and skip concatenation. | Generated geometric scenes, masks and an authored/reference trace. Supplied inference where feasible. |
| **8. Sound Scout** | Spectrogram preparation plus a small audio CNN | Sort short “yes” and “no” clips. See sound turn into a picture before it reaches the network. | Time-frequency representations and transferring CNN ideas to another modality. | Bundled clips and a supplied model. Include visual/transcript alternatives; microphone access is not required. |
| **9. Memory Train** | An unrolled small RNN, then an optional LSTM module | Carry a clue through a row of tokens and use it at the end. Open or close gates to inspect what remains. | Hidden state, recurrence and gates. | Step-by-step state trace on a synthetic sequence. Train elsewhere if desired. |
| **10. The Tiny Typewriter** | A bigram baseline, then token embeddings and a small context MLP | Build a machine that guesses the next character. Change the context and watch its choices. | Tokens, embeddings, shifted targets and sampling. | Small counts-based baseline plus compatible trained examples. Clearly label the bigram baseline as a baseline, not a deep network. |
| **11. Attention Detective** | One attention head, then multiple heads | Give each token a question, find matching clues, mix their values and install a no-peeking curtain. | Q/K/V, score scaling, softmax, weighted sums, causal masks and head shapes. | Exact calculations on very short token sequences; full text-model training is not needed. |
| **12. Shakespeare's Workshop** | A small decoder-only transformer made from reusable modules | Assemble a little theatre of attention and feed-forward blocks. Open a module, trace a character, then explore generation. | How attention, normalization, residuals and repeated modules form a language model. | Compatible supplied checkpoints or labeled recorded traces. Local training only on validated configurations; optional PyTorch/Colab export. |

For Picture Post Office, [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html) is a practical candidate because it provides small color images across ten categories. Begin with a curated inspection set rather than making a full dataset download part of completion. It is a meaningful step beyond MNIST's grayscale handwritten-image classification.

Picture Repair Shop can draw on the structure of TensorFlow's [autoencoder and denoising examples](https://www.tensorflow.org/tutorials/generative/autoencoder). Shortcut City teaches a small module inspired by [residual learning](https://arxiv.org/abs/1512.03385). Paint Every Pixel introduces the contracting/expanding structure of [U-Net](https://arxiv.org/abs/1505.04597) on friendly synthetic scenes rather than implying a medical application. Sound Scout can use the approach and sample data from the official [keyword-recognition tutorial](https://www.tensorflow.org/tutorials/audio/simple_audio). These references inform the designs; none of these browser implementations has been benchmarked or built yet.

## Strong optional branches

These make the collection broader without forcing every learner through every architecture.

| Level | Construction and play | Why it earns a separate level | Execution policy |
| --- | --- | --- | --- |
| **Wardrobe Robot** (first slice implemented) | Classify shoes, shirts and bags using Fashion-MNIST; inspect confusing pairs. | Useful as a transfer challenge or a confusion-matrix lesson. Avoid shipping it merely as an MNIST reskin. | Current levels offer optional browser training on a bundled 3,000/500 subset. A dedicated confusion-matrix exploration remains future work. |
| **Borrow a Brain** | Connect a frozen image feature extractor to a new small classification head. | Introduces transfer learning and the difference between frozen and trainable parameters. | Supplied feature extractor; optional training of the small head only. |
| **Pick My Next Song** | Connect synthetic listener/item embeddings to a score and rank a few tracks. | Introduces similarity, ranking and recommendations beyond class labels. | Tiny transparent example data and fixed or supplied weights. No personal listening data needed. |
| **Find the Toy** | Connect image features to both a category head and a bounding-box head. | Explains classification versus localization and multiple outputs. | Synthetic scenes and a supplied example detector. Full detection training is out of scope. |
| **The Curve Painter** | Build a small regression network and fit a continuous curve. | Gives MSE and numerical prediction their own home instead of forcing every loss into a digit classifier. | Immediate fixed-weight exploration; optional tiny training. |
| **The Forger and the Inspector** | Assemble the roles of a small generator and discriminator. | Introduces competing objectives and why generative training is different. | Clearly labeled authored rounds or supplied checkpoints first. No browser GAN-training promise. |
| **From Snow to Picture** | Arrange noise level, denoiser and repeated denoising steps. | A later generative-model branch with a distinct reverse-process idea. | Supplied toy model or recorded trajectory. Do not present simple image denoising as a complete diffusion model. |

[Fashion-MNIST](https://github.com/zalandoresearch/fashion-mnist) supplies clothing images in the same small grayscale format as MNIST. The frozen-backbone/new-head distinction in Borrow a Brain follows the official [transfer-learning tutorial](https://www.tensorflow.org/tutorials/images/transfer_learning). Dataset selection, redistribution terms, weight provenance, asset sizes and actual browser compatibility remain implementation checks for each branch.

## Mini-games that live inside levels

Keep conceptual interludes short and attached to something the player just built:

| Mini-game | Fits naturally in | Player action |
| --- | --- | --- |
| **Spend Your Confidence** | Digit Detective | Adjust probabilities for a labeled digit and compare accuracy with cross-entropy. |
| **Three Envelopes** | Digit Detective or Picture Post Office | Sort examples into training, validation and final test roles; catch a duplicate crossing the boundary. |
| **Memory Champion** | Digit Detective | Compare recorded, reproducible training/validation curves for a small and oversized model. A fresh training run is optional. |
| **Roll Downhill** | Tiny Sorter or Curve Painter | Choose an update step and see learning-rate effects on a small illustrative landscape. |
| **Drop a Few Clues** | Picture Post Office | Compare training-time dropout with evaluation behavior on a compatible toy example. |
| **Box Your Invention** | Shortcut City | Group, name, reuse and open a module; distinguish new copies from explicitly shared weights. |
| **No Peeking** | Attention Detective | Reveal legal context and repair a mask that exposes the next-token answer. |
| **Turn Up the Temperature** | Tiny Typewriter or Shakespeare | Change sampling while keeping the trained parameters fixed. |

## Three ways to explore a completed build

A level specifies its supported modes explicitly. These are separate from whether the level is complete.

1. **Trace or illustration:** inspect shapes and operations, manipulate a tiny numerical example, or play a recorded reference run. Label which is live, illustrative or recorded. A recording is not evidence that the player's graph executed.
2. **Try supplied weights:** run inference with a bundled or explicitly downloaded model that matches the assembled graph and preprocessing. If too expensive for the device, use the trace route without blocking progress.
3. **Train an experiment:** expose browser training only for configurations we have implemented and validated. For larger architectures, offer a matching export where supported. Do not show a permanently disabled Train button on levels designed for construction alone.

Pretrained weights are not interchangeable with arbitrary player architectures. Match architecture/operation versions, dimensions, parameter names and preprocessing before loading them. If the player builds a valid alternative, award construction credit and either run it with explicitly untrained weights, offer supported training/export, or show the reference model separately. Never quietly run another architecture and call it the player's model.

The primary actions become **Check my build** and **Explore**. **Train** is a level-specific extra. Blocky guides construction and interpretation regardless of execution mode. A slow or unsupported GPU restricts an optional experiment, not the learning map.

## What to build first

Start with a small, varied collection rather than implementing the whole catalog:

1. Keep Digit Detective and add construction-based completion plus its loss/data-split mini-games.
2. Add Picture Post Office. It brings the clearest new family of blocks and a familiar task.
3. Add Picture Repair Shop. It changes the goal from choosing a label to reconstructing an image.
4. Add Shortcut City alongside reusable group blocks and branch support.
5. Add Tiny Typewriter, then Attention Detective and Shakespeare's Workshop as the sequence path.

Tiny Sorter and Impossible Fence can be compact introductory challenges before MNIST. Wardrobe Robot is inexpensive reuse but less conceptually different, so it is lower priority than a CNN or autoencoder level. Segmentation, audio, recurrence and recommendations are later branches. GANs and diffusion are distant candidates, not commitments for the first collection.

Do not invent a separate execution framework per level. A level definition should declare its learning objectives, prerequisite IDs, allowed block catalog, construction validators, exploration tasks, example assets, compatible checkpoints and supported runtime/export modes. Completion records the build/exploration evidence independently of training results. Preserve existing Journey rewards during migration.

## Next image blocks

Introduce **Conv2D** and **Pooling** as separate blocks in a later image level. A LeNet-inspired MNIST challenge can teach spatial filters before moving to color-image classification. MNIST is the dataset, not a prescribed architecture: both dense networks and convolutional models can classify its digits. Show image dimensions, channel counts and feature maps at the ports. Construction and inspecting a filter should earn completion; browser training remains optional. [Original MNIST results](https://yann.lecun.org/exdb/mnist/) include both dense and convolutional networks.
