"""Build card-sized previews; originals remain available in the gallery.

Requires Python 3 and Pillow. Run from the repository root after adding photos.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

output = Path('public/photo-previews')
output.mkdir(exist_ok=True)
previews = {}
original_bytes = preview_bytes = 0
for source in sorted(Path('public/photos').iterdir()):
    if source.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
        continue
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((560, 840), Image.Resampling.LANCZOS)
        # Filenames change when encoded bytes change, allowing safe immutable caching.
        import io
        encoded = io.BytesIO()
        image.save(encoded, 'WEBP', quality=76, method=6)
        data = encoded.getvalue()
    filename = hashlib.sha256(data).hexdigest()[:24] + '.webp'
    (output / filename).write_bytes(data)
    previews['/' + str(source.relative_to('public'))] = '/photo-previews/' + filename
    original_bytes += source.stat().st_size
    preview_bytes += len(data)
Path('lib/photo-previews.json').write_text(json.dumps(previews, indent=2) + '\n')
print(json.dumps({'photos': len(previews), 'originalBytes': original_bytes, 'previewBytes': preview_bytes}))
