# Cắt 10 chữ số (0-9) từ ảnh "0123456789" export trong suốt của Photoshop
# + dấu "." từ layer "2.286" trong PSB, rồi tính metric font để app ghép số.
# → số lớn trên poster dùng đúng PIXEL Photoshop (trùng 100%).
#
# Yêu cầu: pip install fonttools psd-tools
# Cách dùng: python scripts/extract-glyphs.py 0123456789.png "Layout NS dong hanh.psb"
#   - tham số 1: ảnh PNG trong suốt chứa "0123456789" (cùng layer-style số lớn)
#   - tham số 2: file PSB (để lấy dấu ".")

import sys, json
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from psd_tools import PSDImage

SRC = sys.argv[1] if len(sys.argv) > 1 else "digits_src.png"
PSB = sys.argv[2] if len(sys.argv) > 2 else "Layout NS dong hanh.psb"
FONT_PATH = "public/fonts/SVN-CeraBold.otf"
OUT = "public/glyphs"

src = Image.open(SRC).convert("RGBA")
A = np.asarray(src)
Hh = src.height

# Tự dò ranh giới 10 số theo cột trống; nếu "4","5" dính thì tách tại cột hẹp nhất.
colhas = (A[:, :, 3] > 20).any(0)
runs = []
s = None
for x, h in enumerate(colhas):
    if h and s is None:
        s = x
    if not h and s is not None:
        runs.append((s, x - 1))
        s = None
if s is not None:
    runs.append((s, len(colhas) - 1))
if len(runs) == 9:  # 4 và 5 dính -> tách
    widest = max(range(len(runs)), key=lambda i: runs[i][1] - runs[i][0])
    l, r = runs[widest]
    colcount = (A[:, :, 3] > 20).sum(0)
    mid = min(range(l + (r - l) // 3, r - (r - l) // 3), key=lambda x: colcount[x])
    runs = runs[:widest] + [(l, mid - 1), (mid, r)] + runs[widest + 1 :]
assert len(runs) == 10, f"Cần 10 số, dò được {len(runs)}"

order = list("0123456789")
seg = {order[i]: runs[i] for i in range(10)}
cuts = [0] + [(seg[order[i]][1] + seg[order[i + 1]][0]) // 2 for i in range(9)] + [src.width]

glyphs = {}
exp2_h = None
for i, ch in enumerate(order):
    L, R = cuts[i], cuts[i + 1]
    src.crop((L, 0, R, Hh)).save(f"{OUT}/d{ch}.png")
    sub = A[:, seg[ch][0]:seg[ch][1] + 1, 3]
    ys, xs = np.where(sub > 120)
    cx0 = int(seg[ch][0] + xs.min()); cy0 = int(ys.min())
    cx1 = int(seg[ch][0] + xs.max()); cy1 = int(ys.max())
    glyphs[ch] = dict(coreX=cx0 - L, coreY=cy0, coreW=cx1 - cx0 + 1, coreH=cy1 - cy0 + 1,
                      imgW=R - L, imgH=Hh, file=f"d{ch}.png",
                      expX0=cx0, expY0=cy0)  # toạ độ ink trái/trên của glyph trong ảnh nguồn
    if ch == "2":
        exp2_h = cy1 - cy0 + 1

# dấu "." từ PSB
psd = PSDImage.open(PSB)
big = None
def find(ls):
    global big
    for l in ls:
        if l.kind == "type" and l.name == "2.286" and (l.bottom - l.top) > 100:
            big = l
        if l.is_group():
            find(l)
find(psd)
pim = big.composite().convert("RGBA")
PA = np.asarray(pim)
PH = pim.height
ph_has = (PA[:, :, 3] > 30).any(0)
pruns = []; s = None
for x, h in enumerate(ph_has):
    if h and s is None: s = x
    if not h and s is not None: pruns.append((s, x - 1)); s = None
if s is not None: pruns.append((s, len(ph_has) - 1))
# segment hẹp nhất = dấu "."
dotseg = min(pruns, key=lambda r: r[1] - r[0])
di = pruns.index(dotseg)
pl = (pruns[di - 1][1] + dotseg[0]) // 2
pr = (dotseg[1] + pruns[di + 1][0]) // 2
sub = PA[:, dotseg[0]:dotseg[1] + 1, 3]; ys, xs = np.where(sub > 120)
pcx0, pcy0 = int(dotseg[0] + xs.min()), int(ys.min())
pcx1, pcy1 = int(dotseg[0] + xs.max()), int(ys.max())
y2 = np.where(PA[:, pruns[0][0]:pruns[0][1] + 1, 3] > 120)[0]
psb2_h = int(y2.max() - y2.min() + 1)
scale = exp2_h / psb2_h
pc = pim.crop((pl, 0, pr, PH)).resize((round((pr - pl) * scale), round(PH * scale)), Image.LANCZOS)
pc.save(f"{OUT}/dot.png")
glyphs["."] = dict(coreX=round((pcx0 - pl) * scale), coreY=round(pcy0 * scale),
                   coreW=round((pcx1 - pcx0 + 1) * scale), coreH=round((pcy1 - pcy0 + 1) * scale),
                   imgW=pc.width, imgH=pc.height, file="dot.png",
                   psbBottom=round(int(y2.max()) * scale))

# metric font
f = TTFont(FONT_PATH); upem = f["head"].unitsPerEm
gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f["hmtx"]
def bbox(c):
    p = BoundsPen(gs); gs[cmap[ord(c)]].draw(p); return p.bounds
_, _, _, yM = bbox("2"); _, ymn, _, _ = bbox("2")
FS = exp2_h * upem / (yM - ymn)
for ch in order + ["."]:
    glyphs[ch]["adv"] = round(float(hmtx[cmap[ord(ch)]][0]) * FS / upem, 2)
    bx = bbox(ch)
    glyphs[ch]["bearLeft"] = round(float(bx[0]) * FS / upem, 2)
    glyphs[ch]["ascent"] = round(float(bx[3]) * FS / upem, 2)
y2e = np.where(A[:, seg["2"][0]:seg["2"][1] + 1, 3] > 120)[0]
exp_baseline = int(y2e.max())

json.dump(dict(FS=round(float(FS), 2), exp2_h=exp2_h, expBaseline=exp_baseline, glyphs=glyphs),
          open(f"{OUT}/metrics.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ Đã cắt 10 số + '.' -> {OUT}/  (FS≈{FS:.0f}, '2' cao {exp2_h}px)")
