# NewWay Realty — Poster Tri Ân Đồng Hành

Landing page: nhân viên nhập **CCCD** → lấy thông tin nhân sự → **tải ảnh chân dung** →
sinh **poster** giống file thiết kế `Layout NS dong hanh.psb` → **tải về / chia sẻ** lên mạng xã hội.

## Công nghệ
- Next.js 15 (App Router) + React 19 + TypeScript
- Render poster phía client bằng `html-to-image` (giữ đúng font + gradient)
- Ảnh nền poster sinh trực tiếp từ file PSB bằng `psd-tools`

## Cấu trúc
```
app/
  page.tsx              Trang chính: nhập CCCD → thông tin → upload → poster → tải/chia sẻ
  api/lookup/route.ts   API tra cứu nhân sự theo CCCD
  globals.css           Style + @font-face SVN Cera + class số gradient
components/Poster.tsx   Poster 1449x2048: nền + overlay động (toạ độ lấy đúng từ PSB)
lib/                    Kiểu dữ liệu + tra cứu + format ngày/số kiểu VN
data/employees.json     Danh sách nhân sự (sinh từ Excel)
public/
  poster-bg.png         Ảnh nền (đã xoá các field động) — sinh từ PSB
  fonts/                Font SVN Cera (Regular / Medium / Bold)
public/glyphs/          11 glyph số (0-9, ".") cắt từ pixel GỐC Photoshop + metrics.json
design-src/             ảnh nguồn (0123456789.png export từ PS)
scripts/
  import-excel.mjs      Excel/CSV  -> data/employees.json
  build-background.py   PSB        -> public/poster-bg.png
  extract-glyphs.py     0123456789.png + PSB -> public/glyphs/ (số lớn pixel-perfect)
```

## Chạy local
```bash
npm install
npm run import   # nạp data từ file Excel -> data/employees.json (xem bên dưới)
npm run dev      # http://localhost:3000
```

## Chạy bằng Docker (production)
```bash
npm run import                       # 1) nạp data nhân sự (chạy 1 lần, hoặc khi đổi file)
docker compose up --build -d         # 2) build + chạy -> http://localhost:3000
# hoặc:
docker build -t newway-poster .
docker run -d -p 3000:3000 newway-poster
```
- Image ~327MB (Next.js standalone + Alpine). Data nhân sự đã được **bundle sẵn** trong image
  (build từ `data/employees.json`). File Excel gốc KHÔNG đưa vào image (xem `.dockerignore`).
- Khi cập nhật danh sách: chạy lại `npm run import` rồi `docker compose up --build -d`.

## Nạp dữ liệu nhân sự từ Excel (chức năng import)
Mặc định đọc file `Danh sách Sales phục vụ sinh nhật 5 năm (1).xlsx`, **sheet "Chốt"**:
```bash
npm run import                              # file & sheet mặc định
npm run import "duong-dan.xlsx" "TênSheet"  # tuỳ chọn
```
→ sinh ra `data/employees.json` (app đọc để tra cứu CCCD + sinh poster).

Map cột (dò theo TÊN cột, không phân biệt hoa thường / dấu):

| Trường poster | Cột Excel |
|---|---|
| CCCD (tra cứu) | `Số CMND/ CCCD` |
| Họ tên | `Họ và tên` |
| Chức danh | `Chức vụ` |
| Ngày gia nhập | `Ngày vào làm` |
| Cấp bậc | `Cấp bậc` |
| **Số ngày** (số lớn) | `Số ngày làm việc` |
| **Giờ học hỏi** | `Số giờ làm việc` |

- 3 ô còn lại (cuộc gọi / cuộc gặp / cơ hội) KHÔNG có trong file → dùng giá trị chung
  `FIXED_STATS` trong `lib/import-core.mjs` (mặc định 5.000+ / 500+ / 50+). Sửa tại đó nếu cần.
- Chỉ lấy người `Tình trạng công tác = Active` (đổi `onlyActive` nếu muốn lấy hết).
- Tên/chức danh/cấp bậc dài (vd "HUYỀN THOẠI", "TRƯỞNG PHÒNG PTĐT") **tự co cỡ chữ** cho vừa khung.

### Cách 2 — Trang admin qua web (không cần CLI)
Khu vực quản trị (bảo vệ bằng mật khẩu **`ADMIN_PASSWORD`**, mặc định `newway2026` — **ĐỔI khi deploy**):

- **`/admin`** — Import Excel: nhập mật khẩu → chọn sheet + file `.xlsx` → **Import & cập nhật**.
- **`/admin/employees`** — Danh sách nhân viên: **tìm kiếm** (tên/CCCD/chức danh/cấp bậc), phân trang,
  **Sửa** từng người (họ tên, chức danh, ngày vào làm, số ngày, cấp bậc, 4 chỉ số) khi thông tin bị sai,
  hoặc **Xoá**. Trang tra cứu dùng ngay dữ liệu đã sửa.

- Data lưu ở `DATA_PATH` (mặc định `runtime-data/employees.json`). Trong Docker mount **volume
  `employees-data`** → giữ qua các lần restart. Khi chưa có data runtime, app dùng data bundle sẵn.
- Logic đọc Excel dùng chung `lib/import-core.mjs` (giống hệt CLI).
- API: `GET/PUT/DELETE /api/admin/employees`, `POST /api/admin/import` (đều cần header
  `x-admin-password` hoặc field mật khẩu).

## Khi thiết kế (PSB) thay đổi
Tạo lại ảnh nền:
```bash
pip install "psd-tools[composite]"
python scripts/build-background.py "Layout NS dong hanh.psb"
```

## Deploy Vercel
```bash
vercel        # hoặc đẩy lên GitHub rồi import vào Vercel
```
Không cần biến môi trường. Dữ liệu nằm trong `data/employees.json` (đẩy kèm khi deploy).

## Ghi chú
- 4 ô số liệu (cuộc gọi / cuộc gặp / cơ hội / giờ) đều là **dữ liệu riêng từng người**;
  ảnh nền đã xoá sạch số mẫu để overlay hiển thị đúng.
- **Font đúng theo PSB** (trích từ layer-style file gốc):
  - Tên: SVN-CeraBold · Chức danh: SVN-Cera · Ngày/Cấp bậc & số ngày lớn: SVN-CeraBold
  - Số liệu (8.200+, 41.300…) & số trong câu trích: **Bahnschrift SemiBold Condensed** (wght 600, wdth 75)
- **Số ngày lớn = pixel GỐC Photoshop**: [components/BigNumber.tsx](components/BigNumber.tsx) ghép số
  từ 11 glyph (0-9, ".") cắt trực tiếp từ ảnh PS export (`public/glyphs/`) → trùng PSB 100%
  (đủ gradient + bevel + glow + shadow thật). Canh vị trí/kerning theo metric font SVN-CeraBold.
  - Khi đổi thiết kế số: export lại `0123456789` (PNG trong suốt) rồi chạy
    `python scripts/extract-glyphs.py duong-dan.png "Layout NS dong hanh.psb"`.
- `scripts/shot.mjs`, `scripts/flow.mjs` là công cụ QA (chụp poster bằng Chrome headless),
  không ảnh hưởng app khi chạy thật.
