# Tạo ảnh nền poster (public/poster-bg.png) từ file PSB:
#  - ẩn các layer động (ảnh, tên, chức danh, ngày, cấp bậc, số ngày, số giờ)
#  - ẩn layer flatten trùng lặp "Cam on dong hanh"
#  - xoá 3 số liệu baked (5.000+ / 500+ / 50+) để cả 4 ô đều là overlay động
#
# Yêu cầu:  pip install "psd-tools[composite]"
# Cách dùng: python scripts/build-background.py "Layout NS dong hanh.psb"

import sys
from psd_tools import PSDImage
from PIL import Image
import numpy as np

src = sys.argv[1] if len(sys.argv) > 1 else "Layout NS dong hanh.psb"
psd = PSDImage.open(src)

HIDE = {
    "Cam on dong hanh",               # bản flatten trùng lặp
    "Nguyễn Thị Kiều Trang (new)",    # ảnh chân dung
    "nguyễn thị kiều trang",          # họ tên
    "giám đốc ptđt",                  # chức danh
    "15.11.2022",                     # ngày gia nhập
    "tinh anh",                       # cấp bậc
    "2.286",                          # số ngày (cả số lớn lẫn trong câu trích)
    "33.456",                         # số giờ
    "Rectangle 1",                    # khung tên -> đưa ra overlay (vẽ TRÊN ảnh, căn giữa ảnh)
}

def walk(layers):
    for l in layers:
        if l.name in HIDE:
            l.visible = False
        if l.is_group():
            walk(l)

walk(psd)
img = psd.composite(force=True).convert("RGB")

# Xoá 3 số baked trong hàng số liệu (5.000+, 500+, 50+) bằng cách
# trải dải màu sạch bên trái mỗi thẻ qua vùng chữ số.
a = np.array(img)
cards = [((628, 792), (610, 626)), ((842, 968), (826, 840)), ((1046, 1150), (1028, 1044))]
y0, y1 = 1462, 1528
for (nx0, nx1), (sx0, sx1) in cards:
    rowcol = a[y0:y1, sx0:sx1, :].mean(axis=1, keepdims=True).astype(np.uint8)
    a[y0:y1, nx0:nx1, :] = np.repeat(rowcol, nx1 - nx0, axis=1)

# Làm đậm màu chữ "FIGHT FOR FIVE" cho nổi bật hơn.
# Làm đậm MƯỢT theo độ xanh: chỉ pixel xanh đậm (chữ) mới tối đi, còn
# silhouette toà nhà / skyline (độ xanh thấp) giữ nguyên -> không tạo vệt xám.
fa = a.astype(float)
y0, y1, fx0, fx1 = 1880, 1965, 400, 1075
reg = fa[y0:y1, fx0:fx1, :]
greenness = reg[:, :, 1] - (reg[:, :, 0] + reg[:, :, 2]) / 2
t = np.clip((greenness - 52) / 45, 0, 1)
factor = 1 - t * 0.42
for c in range(3):
    reg[:, :, c] = reg[:, :, c] * factor
fa[y0:y1, fx0:fx1, :] = reg
a = np.clip(fa, 0, 255).astype("uint8")

Image.fromarray(a).save("public/poster-bg.png")
print("✓ Đã tạo public/poster-bg.png", img.size)
