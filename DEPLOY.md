# Deploy lên VPS — domain `sinhnhat.newwayrealty.vn`

App chạy trong Docker (cổng 3000), Nginx reverse proxy + SSL Let's Encrypt cho domain.

---

## 0) DNS (làm trước, chờ vài phút cho phân giải)
Vào trang quản lý DNS của `newwayrealty.vn`, thêm bản ghi:

| Type | Name        | Value (IP VPS)   |
|------|-------------|------------------|
| A    | `sinhnhat`  | `<IP_VPS_CỦA_BẠN>` |

Kiểm tra: `ping sinhnhat.newwayrealty.vn` ra đúng IP VPS là OK.

---

## 1) Cài Docker trên VPS (Ubuntu)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker     # chạy docker không cần sudo
docker --version && docker compose version
```

## 2) Lấy code về VPS
Repo PRIVATE → tạo **Personal Access Token** (GitHub → Settings → Developer settings →
Tokens, quyền `repo`) rồi:
```bash
cd /opt
git clone https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git newway-poster
cd newway-poster
```

## 3) Đặt mật khẩu admin
```bash
cp .env.example .env
nano .env            # đổi ADMIN_PASSWORD=... thành mật khẩu mạnh
```

## 4) Build & chạy container
```bash
docker compose up -d --build
docker compose ps                 # thấy newway-poster Up, cổng 3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 200 là OK
```
> Data 1.022 nhân sự đã có sẵn trong image. Sau này cập nhật: vào `/admin` upload Excel,
> hoặc `/admin/employees` sửa tay (data lưu ở volume, không mất khi restart/rebuild).

## 5) Nginx reverse proxy
```bash
sudo apt update && sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sinhnhat.newwayrealty.vn
sudo ln -s /etc/nginx/sites-available/sinhnhat.newwayrealty.vn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Mở thử `http://sinhnhat.newwayrealty.vn` (chưa SSL) — thấy app là OK.

## 6) SSL (HTTPS) miễn phí — Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sinhnhat.newwayrealty.vn
# chọn redirect HTTP -> HTTPS khi được hỏi
```
Xong: **https://sinhnhat.newwayrealty.vn** chạy có khoá xanh. Certbot tự gia hạn.

---

## Vận hành

**Cập nhật code mới:**
```bash
cd /opt/newway-poster
git pull
docker compose up -d --build
```

**Xem log / restart:**
```bash
docker compose logs -f --tail=100
docker compose restart
```

**Cập nhật danh sách nhân sự:** vào `https://sinhnhat.newwayrealty.vn/admin`
(mật khẩu trong `.env`) → upload file Excel, hoặc `/admin/employees` để sửa/xoá từng người.
Data lưu ở Docker volume `employees-data` → **giữ nguyên** kể cả khi `git pull` + rebuild.

**Backup data đã upload:**
```bash
docker run --rm -v newway-poster_employees-data:/d -v $PWD:/b alpine \
  sh -c "cp /d/employees.json /b/employees-backup.json"
```

---

## Phương án thay thế (đơn giản hơn, tự lo SSL): Caddy
Nếu không muốn cấu hình Nginx + certbot, dùng Caddy (tự cấp SSL). Tạo `Caddyfile`:
```
sinhnhat.newwayrealty.vn {
    reverse_proxy 127.0.0.1:3000
    request_body { max_size 25MB }
}
```
rồi `caddy run` (hoặc chạy Caddy bằng Docker). Caddy tự xin Let's Encrypt.
