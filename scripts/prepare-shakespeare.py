"""Pack Tiny Shakespeare for the browser. Assets are committed.

The text is Andrej Karpathy's char-rnn `input.txt` (the same text as the Hugging Face
`karpathy/tiny_shakespeare` dataset). It is downloaded from a pinned commit, checked against a
known SHA-256 and stored gzipped without changes. The playground splits it 90/10 into two
contiguous regions, like nanoGPT's character-level preparation.
"""
import gzip
import hashlib
import json
import urllib.request
from pathlib import Path

DEST = Path(__file__).resolve().parents[1] / 'public' / 'data'
COMMIT = '6f9487a6fe5b420b7ca9afb0d7c078e37c1d1b4e'
SOURCE = f'https://raw.githubusercontent.com/karpathy/char-rnn/{COMMIT}/data/tinyshakespeare/input.txt'
SHA256 = '86c4e6aa9db7c042ec79f339dcb96d42b0075e16b8fc2e86bf0ca57e2dc565ed'

raw = urllib.request.urlopen(SOURCE, timeout=60).read()
assert hashlib.sha256(raw).hexdigest() == SHA256, 'Unexpected input.txt contents'
text = raw.decode('utf-8')
alphabet = ''.join(sorted(set(text)))
compressed = gzip.compress(raw, compresslevel=9, mtime=0)
DEST.mkdir(exist_ok=True, parents=True)
(DEST / 'tiny-shakespeare.txt.gz').write_bytes(compressed)
manifest = {
    'source': SOURCE,
    'dataset': 'https://huggingface.co/datasets/karpathy/tiny_shakespeare',
    'characters': len(text),
    'alphabet': alphabet,
    'split': {'train': 0.9, 'validation': 0.1, 'policy': 'first 90% / last 10%, contiguous'},
    'sha256': {'text': SHA256, 'gzip': hashlib.sha256(compressed).hexdigest()},
}
(DEST / 'tiny-shakespeare-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(len(text), len(alphabet), len(compressed))
