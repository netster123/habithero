"""Erzeugt die App-Icons als PNG ohne externe Bibliotheken.

Motiv: grünes Quadrat mit weißem, nach oben steigendem Pfeil über drei Stufen
(„Schritt für Schritt nach oben“).  Aufruf:  python3 tools/make-icons.py
"""
import os
import struct
import zlib

BG = (29, 158, 117)
FG = (255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')


def png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


def inside(x, y, safe):
    """Motiv in Einheitskoordinaten 0..1; safe = Rand für maskierbare Icons."""
    u = (x - safe) / (1 - 2 * safe)
    v = (y - safe) / (1 - 2 * safe)
    if not (0 <= u <= 1 and 0 <= v <= 1):
        return False
    # drei Stufen
    steps = [(0.18, 0.62, 0.36, 0.80), (0.40, 0.48, 0.58, 0.80), (0.62, 0.34, 0.80, 0.80)]
    for x0, y0, x1, y1 in steps:
        if x0 <= u <= x1 and y0 <= v <= y1:
            return True
    # Pfeilspitze über der höchsten Stufe
    cx, top, base, half = 0.71, 0.14, 0.29, 0.11
    if top <= v <= base and abs(u - cx) <= half * (v - top) / (base - top):
        return True
    return False


def render(size, safe, ss=3):
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    if inside((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, safe):
                        hits += 1
            a = hits / (ss * ss)
            row += [round(BG[i] * (1 - a) + FG[i] * a) for i in range(3)]
        rows.append(row)
    return rows


os.makedirs(OUT, exist_ok=True)
for name, size, safe in [
    ('apple-touch-icon.png', 180, 0.10),
    ('icon-192.png', 192, 0.10),
    ('icon-512.png', 512, 0.10),
    ('icon-maskable-512.png', 512, 0.20),
]:
    png(os.path.join(OUT, name), size, size, render(size, safe))
    print('erstellt', name)
