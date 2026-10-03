"""Create a small, deterministic MNIST subset. Run once; assets are committed."""
import gzip
import hashlib
import json
import random
import struct
import urllib.request
from pathlib import Path

DEST = Path(__file__).resolve().parents[1] / 'public' / 'data'
BASE = 'https://storage.googleapis.com/cvdf-datasets/mnist/'
FILES = {'train-images-idx3-ubyte.gz': 'f68b3c2dcbeaaa9fbdd348bbdeb94873',
         'train-labels-idx1-ubyte.gz': 'd53e105ee54ea40749a09fcbcd1e9432',
         't10k-images-idx3-ubyte.gz': '9fb629c4189551a2d022fa330f9573f3',
         't10k-labels-idx1-ubyte.gz': 'ec29112dd5afa0611ce80d1b7f02629c'}

def download(name):
    raw = urllib.request.urlopen(BASE + name, timeout=60).read()
    assert hashlib.md5(raw).hexdigest() == FILES[name], name
    return gzip.decompress(raw)

manifest = {'source': BASE, 'seed': 1958, 'pixels': 784, 'classes': 10, 'splits': {}}
DEST.mkdir(exist_ok=True, parents=True)
for split, prefix, count in [('train', 'train', 3000), ('test', 't10k', 500)]:
    images = download(prefix + '-images-idx3-ubyte.gz')
    labels = download(prefix + '-labels-idx1-ubyte.gz')[8:]
    magic, total, rows, cols = struct.unpack('>IIII', images[:16])
    assert magic == 2051 and rows == cols == 28 and len(labels) == total
    indices = random.Random(1958).sample(range(total), count)
    # Each record: label byte, then 784 grayscale pixel bytes.
    records = b''.join(bytes([labels[i]]) + images[16+i*784:16+(i+1)*784] for i in indices)
    compressed = gzip.compress(records, mtime=0)
    (DEST / f'mnist-{split}.bin.gz').write_bytes(compressed)
    manifest['splits'][split] = {'count': count, 'bytes': len(records), 'sha256': hashlib.sha256(compressed).hexdigest()}
    print(split, count, len(compressed))
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
