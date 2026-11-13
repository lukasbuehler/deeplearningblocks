# Bundled teaching datasets

The image assets are small, deterministic subsets, not full benchmarks. Each image set has 3,000 training images and 500 images from the original separate test split. Records contain a class byte followed by 784 grayscale pixel bytes. The browser normalizes pixels to [0, 1].

- **MNIST**: handwritten digits, by Yann LeCun, Corinna Cortes and Christopher J. C. Burges. [Original dataset](https://yann.lecun.org/exdb/mnist/index.html). Existing assets and `manifest.json` remain unchanged.
- **Fashion-MNIST**: ten clothing categories, by Han Xiao, Kashif Rasul and Roland Vollgraf, Zalando Research, 2017. [Official dataset and label map](https://github.com/zalandoresearch/fashion-mnist). Distributed under the included `FASHION-MNIST-LICENSE.txt` (MIT). `fashion-mnist-manifest.json` records the source and subset hashes. No image processing beyond selecting records and repacking was applied.

- **Tiny Shakespeare**: about 40,000 lines from Shakespeare's plays (public domain), selected by Andrej Karpathy for [char-rnn](https://github.com/karpathy/char-rnn) (2015) and also published as [karpathy/tiny_shakespeare](https://huggingface.co/datasets/karpathy/tiny_shakespeare). `tiny-shakespeare.txt.gz` is the complete, unchanged `input.txt` (1,115,394 characters, 65 distinct characters), only gzip-compressed. Redistributed under the char-rnn MIT license in `TINY-SHAKESPEARE-LICENSE.txt`. `tiny-shakespeare-manifest.json` records the pinned source commit, the alphabet, both hashes and the split: the first 90% of characters train the model and the last 10% are held out. Training windows never cross that boundary.

To reproduce the image subsets:

```sh
python3 scripts/prepare-mnist.py --dataset mnist
python3 scripts/prepare-mnist.py --dataset fashion-mnist
```

The script verifies the upstream archive checksums and selects original indices with Python's `random.Random(1958).sample`, resetting the seed for each split. Python/Colab exports use the same sampling, official torchvision dataset classes, and normalization. Full upstream archives are downloaded only when regenerating assets or running an export; browser play uses the bundled subsets.

Class order for clothing: T-shirt/top, Trouser, Pullover, Dress, Coat, Sandal, Shirt, Sneaker, Bag, Ankle boot. The compact chart uses T, Tr, P, D, C, Sa, Sh, Sn, B, Ab; tooltips contain full labels.

To reproduce the text asset:

```sh
python3 scripts/prepare-shakespeare.py
```

It downloads `input.txt` from a pinned char-rnn commit, checks its SHA-256 and compresses it with a fixed timestamp, so the output is byte-identical.
