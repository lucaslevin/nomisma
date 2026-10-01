#!/usr/bin/env python3
"""Generate Nomisma's PNG icons: a rounded square with a multi-color pastel
gradient and a white outline.

Pure standard library: no Pillow, no external tools. Run from repo root:
    python3 tools/make-icons.py
"""

import os
import struct
import zlib

SIZES = [16, 32, 48, 128]
SS = 4  # supersampling factor
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

# Multi-stop pastel gradient, sampled along the top-left -> bottom-right axis.
STOPS = [
    (0.00, (0xC4, 0xB5, 0xFD)),  # lavender
    (0.25, (0xA5, 0xC8, 0xFF)),  # periwinkle
    (0.50, (0xB8, 0xF2, 0xD8)),  # mint
    (0.75, (0xFF, 0xE3, 0xA3)),  # peach
    (1.00, (0xFF, 0xB3, 0xC6)),  # pink
]
EDGE = (0xFF, 0xFF, 0xFF)  # white outline


def lerp_color(t):
    for i in range(len(STOPS) - 1):
        t0, c0 = STOPS[i]
        t1, c1 = STOPS[i + 1]
        if t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(round(c0[j] + (c1[j] - c0[j]) * f) for j in range(3))
    return STOPS[-1][1]


def rounded_rect_sdf(x, y, n):
    """Signed distance to a rounded square centred in the n x n canvas."""
    c = n / 2.0
    half = 0.47 * n
    r = 0.30 * half
    qx = abs(x - c) - (half - r)
    qy = abs(y - c) - (half - r)
    ax = qx if qx > 0 else 0.0
    ay = qy if qy > 0 else 0.0
    return (ax * ax + ay * ay) ** 0.5 + min(max(qx, qy), 0.0) - r


def sample(x, y, n):
    """Return (r,g,b,a) for a point in [0,n)."""
    d = rounded_rect_sdf(x, y, n)
    if d > 0:
        return (0, 0, 0, 0)  # outside the shape
    if d > -max(1.5, 0.07 * n):
        return (*EDGE, 255)  # outline band

    t = (x + y) / (2.0 * n)
    t = max(0.0, min(1.0, t))
    r, g, b = lerp_color(t)
    return (r, g, b, 255)


def render(n):
    out = bytearray()
    for y in range(n):
        row = bytearray()
        for x in range(n):
            ar = ag = ab = aa = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = x + (sx + 0.5) / SS
                    py = y + (sy + 0.5) / SS
                    r, g, b, a = sample(px, py, n)
                    ar += r * a
                    ag += g * a
                    ab += b * a
                    aa += a
            total = SS * SS
            if aa == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes((ar // aa, ag // aa, ab // aa, aa // total))
        out += b"\x00" + row  # filter type 0
    return bytes(out)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, n, raw):
    ihdr = struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for n in SIZES:
        path = os.path.join(OUT, f"icon{n}.png")
        write_png(path, n, render(n))
        print("wrote", os.path.relpath(path))


if __name__ == "__main__":
    main()
