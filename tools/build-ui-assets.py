"""Rebuild the minimal UI's small pixel pictograms and digit-only font (stdlib only)."""
from pathlib import Path
import json
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
INK = (57, 61, 58, 255)
PAPER = (253, 253, 247, 255)


def png(name, grid, scale=3):
    width, height = len(grid[0]) * scale, len(grid) * scale
    palette = {".": (0, 0, 0, 0), "#": INK, "o": PAPER}
    raw = b"".join(b"\0" + bytes(c for symbol in row for _ in range(scale) for c in palette[symbol])
                   for row in grid for _ in range(scale))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    (ROOT / "assets/cutouts" / name).write_bytes(data)
    return {"file": name, "pixel_grid": [len(grid[0]), len(grid)], "size": [width, height], "transparent": True}


def canvas(width, height):
    return [["."] * width for _ in range(height)]


def person(grid, x, y, size, outlined):
    # Stepped round head and simple shoulder/torso; no face, clothes or limbs.
    radius = size / 2
    for row in range(size):
        for col in range(size):
            d = (col + .5 - radius) ** 2 + (row + .5 - radius) ** 2
            if d <= radius ** 2:
                grid[y + row][x + col] = "#" if not outlined or d >= (radius - 1.2) ** 2 else "o"
    for row in range(size):
        inset = 2 if row == 0 else 1 if row == 1 else 0
        for col in range(inset, size + 4 - inset):
            edge = row in (0, size - 1) or col in (inset, size + 3 - inset)
            grid[y + size + 1 + row][x - 2 + col] = "#" if edge or not outlined else "o"


visitors = canvas(48, 36)
person(visitors, 4, 11, 9, True)
person(visitors, 35, 11, 9, True)
person(visitors, 18, 5, 12, True)
staff = canvas(24, 26)
person(staff, 8, 3, 8, False)
memo = canvas(22, 26)
for y in range(3, 24):
    for x in range(4, 18):
        memo[y][x] = "#"
for y in (8, 13, 18):
    for x in range(7, 15):
        memo[y][x] = "o"
assets = [png("UI-03_visitors-minimal.png", visitors), png("UI-06_staff-minimal.png", staff), png("UI-07_memo-minimal.png", memo)]

# Seven-row digit glyphs, converted to a tiny TrueType font. Japanese remains the system font.
patterns = {
    " ": ["000"] * 7,
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    ",": ["00", "00", "00", "00", "00", "01", "10"],
    "0": ["01110", "11011", "11011", "11011", "11011", "11011", "01110"],
    "1": ["00110", "01110", "00110", "00110", "00110", "00110", "11111"],
    "2": ["01110", "11011", "00011", "00110", "01100", "11000", "11111"],
    "3": ["11110", "00011", "00011", "01110", "00011", "00011", "11110"],
    "4": ["00011", "00111", "01111", "11011", "11111", "00011", "00011"],
    "5": ["11111", "11000", "11000", "11110", "00011", "11011", "01110"],
    "6": ["01110", "11000", "11000", "11110", "11011", "11011", "01110"],
    "7": ["11111", "00011", "00110", "00110", "01100", "01100", "01100"],
    "8": ["01110", "11011", "11011", "01110", "11011", "11011", "01110"],
    "9": ["01110", "11011", "11011", "01111", "00011", "00011", "01110"],
}
u16 = lambda *values: struct.pack(">" + "H" * len(values), *values)
s16 = lambda *values: struct.pack(">" + "h" * len(values), *values)
u32 = lambda *values: struct.pack(">" + "I" * len(values), *values)
pad = lambda data: data + b"\0" * (-len(data) % 4)
checksum = lambda data: sum(struct.unpack(">" + "I" * (len(pad(data)) // 4), pad(data))) & 0xffffffff


def glyph(rows):
    points = []
    for row, line in enumerate(rows):
        for col, filled in enumerate(line):
            if filled == "1":
                x, y = col * 100, (6 - row) * 100
                points += [(x, y), (x, y + 100), (x + 100, y + 100), (x + 100, y)]
    contours = len(points) // 4
    data = s16(contours, 0, 0, len(rows[0]) * 100, 700)
    data += u16(*(i * 4 + 3 for i in range(contours))) + u16(0) + bytes([1] * len(points))
    for axis in (0, 1):
        previous = 0
        for point in points:
            data += s16(point[axis] - previous)
            previous = point[axis]
    return pad(data)


glyphs = [glyph(patterns[" "])] + [glyph(rows) for rows in patterns.values()]
count = len(glyphs)
offsets, total = [], 0
for data in glyphs:
    offsets.append(total)
    total += len(data)
offsets.append(total)
codes = [ord(c) for c in patterns] + [0xffff]
segments = len(codes)
power = 2 ** int(math.log2(segments))
cmap = u16(4, 16 + 8 * segments, 0, 2 * segments, 2 * power, int(math.log2(power)), 2 * segments - 2 * power)
cmap += u16(*codes) + u16(0) + u16(*codes)
cmap += u16(*[(i + 1 - code) & 0xffff for i, code in enumerate(codes[:-1])], 1) + u16(*([0] * segments))
names = []
strings = b""
for name_id, value in ((1, "Reception Pixel Digits"), (2, "Bold"), (4, "Reception Pixel Digits Bold"), (6, "ReceptionPixelDigits-Bold")):
    encoded = value.encode("utf-16-be")
    names.append(u16(3, 1, 0x409, name_id, len(encoded), len(strings)))
    strings += encoded
tables = {
    "cmap": u16(0, 1, 3, 1) + u32(12) + cmap,
    "glyf": b"".join(glyphs), "loca": u32(*offsets),
    "head": struct.pack(">IIIIHHQQhhhhHHhhh", 0x10000, 0x10000, 0, 0x5f0f3cf5, 3, 1000, 0, 0, 0, -200, 600, 800, 1, 8, 2, 1, 0),
    "hhea": u32(0x10000) + s16(800, -200, 0, 600, 0, 0, 600, 1, 0, 0, 0, 0, 0, 0, 0, count),
    "hmtx": b"".join(u16(600 if i == 0 else (len(list(patterns.values())[i - 1][0]) + 1) * 100) + s16(0) for i in range(count)),
    "maxp": u32(0x10000) + u16(count, 140, 35, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0),
    "name": u16(0, len(names), 6 + len(names) * 12) + b"".join(names) + strings,
    "post": struct.pack(">IihhIIIII", 0x30000, 0, -100, 50, 0, 0, 0, 0, 0),
    "OS/2": u16(0) + s16(600) + u16(700, 5, 0) + s16(650, 600, 0, 75, 650, 600, 0, 350, 50, 250, 0) + bytes(10) + u32(1, 0, 0, 0) + b"YAMA" + u16(0x20, 32, 57) + s16(800, -200, 0) + u16(800, 200),
}
table_count = len(tables)
power = 2 ** int(math.log2(table_count))
font = u32(0x10000) + u16(table_count, power * 16, int(math.log2(power)), table_count * 16 - power * 16)
offset = 12 + 16 * table_count
directory, payload, head_offset = b"", b"", 0
for tag, data in sorted(tables.items()):
    directory += tag.encode("ascii") + u32(checksum(data), offset, len(data))
    if tag == "head":
        head_offset = offset
    payload += pad(data)
    offset += len(pad(data))
font = bytearray(font + directory + payload)
struct.pack_into(">I", font, head_offset + 8, (0xb1b0afba - checksum(font)) & 0xffffffff)
(ROOT / "assets/fonts").mkdir(exist_ok=True)
(ROOT / "assets/fonts/reception-digits.ttf").write_bytes(font)
(ROOT / "assets/cutouts/minimal-8bit-manifest.json").write_text(json.dumps({
    "reference": "assets/reference/final_ui_reference_20261031_preview.webp",
    "method": "Small code-native pixel pictograms following the approved reference and written spec; no AI regeneration or whole-screen image.",
    "assets": assets, "digits": "assets/fonts/reception-digits.ttf",
    "source": "tools/build-ui-assets.py", "font_scope": "Digits, plus and comma only; Japanese uses the system font."
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Built 3 transparent pictograms and the local digit-only font")
