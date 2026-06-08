# Deploy `sinhnhat.newwayrealty.vn` (cùng convention với giaitrinh)

App Next.js chạy trong Docker, bind **`127.0.0.1:3003`**, nginx host proxy domain vào.

> Quy ước port trên VPS: `3001`=roadmap2026, `3002`=giaitrinh, **`3003`=sinhnhat**.
> Trước khi chạy, đảm bảo **3003 chưa bị chiếm** (xem mục Kiểm tra bên dưới).

---

## Cách nhanh — dùng `deploy.sh`
```bash
# Lần đầu (repo private -> kèm token GitHub)
cd /opt
git clone https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git sinhnhat
cd sinhnhat
nano .env            # nếu chưa có: cp .env.example .env ; đổi ADMIN_PASSWORD
bash deploy.sh https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git
```
Script tự: pull/clone → tạo `.env` → `docker compose build && up -d` → cài nginx → kiểm tra.

Cập nhật về sau: `cd /opt/sinhnhat && bash deploy.sh`

---

## Hoặc làm thủ công

### 0) Kiểm tra port & nginx hiện trạng (quan trọng — VPS nhiều dự án)
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"          # xem port các container
sudo ss -tlnp | grep -E ':80|:443|:3003'                   # 3003 phải TRỐNG; xem ai giữ 80/443
ls /etc/nginx/sites-enabled/                               # các site nginx host đang có
```
Nếu `3003` đã bị chiếm → đổi sang port trống trong `docker-compose.yml` và `deploy/nginx-sinhnhat.conf`.

### 1) Lấy code + cấu hình
```bash
cd /opt
git clone https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git sinhnhat
cd sinhnhat
cp .env.example .env && nano .env       # đổi ADMIN_PASSWORD mạnh
```

### 2) Build + chạy container
```bash
docker compose build
docker compose up -d
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3003/    # 200 = OK
```

### 3) Nginx host
```bash
sudo cp deploy/nginx-sinhnhat.conf /etc/nginx/sites-available/sinhnhat
sudo ln -sf /etc/nginx/sites-available/sinhnhat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4) DNS + SSL (Cloudflare — giống giaitrinh)
- Cloudflare: thêm bản ghi `sinhnhat` → IP VPS.
  - **Proxied (cam):** SSL mode = **Full**. Xong, có HTTPS luôn.
  - **DNS only (xám):** chạy `sudo certbot --nginx -d sinhnhat.newwayrealty.vn`.

### 5) Truy cập
- Nhân viên: **https://sinhnhat.newwayrealty.vn**
- Admin: **/admin** (import Excel) · **/admin/employees** (sửa/xoá) — mật khẩu trong `.env`.

---

## Vận hành
```bash
cd /opt/sinhnhat
docker compose logs -f app          # log
docker compose restart app          # restart
git pull && docker compose up -d --build   # cập nhật code (data ở volume KHÔNG mất)
```

**Backup data đã upload:**
```bash
docker run --rm -v sinhnhat_employees-data:/d -v $PWD:/b alpine \
  sh -c "cp /d/employees.json /b/employees-backup-$(date +%Y%m%d).json"
```

> Data nhân sự lưu ở Docker volume `sinhnhat_employees-data` (qua `/admin`) → giữ nguyên kể cả
> khi `git pull` + rebuild. Image cũng đã bundle sẵn 1.022 nhân sự làm mặc định.
