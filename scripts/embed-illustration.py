#!/usr/bin/env python3
"""
Bakes assets/hand-graphic.png into src/hand-graphic.js as a data URI.

The library ships as a single file with no external requests, so the artwork
has to travel inside the bundle. A 64-colour palette costs nothing visible —
the source is flat greys plus two brand colours — and takes the PNG from ~50kB
to ~6kB, which is the difference between the illustration being affordable and
not.

Needs Pillow, and only ever needs running when the artwork changes:

    pip install pillow && python3 scripts/embed-illustration.py
"""
import base64
import io
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets' / 'hand-graphic.png'
TARGET = ROOT / 'src' / 'hand-graphic.js'
COLORS = 64

from PIL import Image  # noqa: E402

image = Image.open(SOURCE).convert('RGBA')
buffer = io.BytesIO()
image.quantize(colors=COLORS, method=Image.FASTOCTREE).save(buffer, 'PNG', optimize=True)
encoded = base64.b64encode(buffer.getvalue()).decode('ascii')

TARGET.write_text(
    '/**\n'
    ' * The hand illustration on the pre-enabled card, inlined so the library\n'
    ' * stays a single file with no external requests.\n'
    ' *\n'
    f' * Generated from assets/hand-graphic.png ({image.width}x{image.height}, quantized\n'
    f' * to {COLORS} colours) by scripts/embed-illustration.py. Do not edit by hand.\n'
    ' */\n'
    f"export const HAND_GRAPHIC = 'data:image/png;base64,{encoded}';\n"
)

print(f'{SOURCE.name} {SOURCE.stat().st_size:,}B -> {TARGET.name} {TARGET.stat().st_size:,}B')
