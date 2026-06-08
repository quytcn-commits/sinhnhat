#!/bin/bash
# Deploy sinhnhat.newwayrealty.vn trên VPS (cùng convention với giaitrinh)
#   - container sinhnhat-app, bind 127.0.0.1:3003
#   - nginx host proxy sinhnhat.newwayrealty.vn -> 127.0.0.1:3003
#
# Lần đầu:  ./deploy.sh https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git
# Cập nhật: ./deploy.sh
set -e

APP_DIR="/opt/sinhnhat"
REPO_URL="$1"

echo "=== DEPLOY SINH NHẬT 5 NĂM ==="

# 1. Clone hoặc pull
if [ -d "$APP_DIR/.git" ]; then
  echo ">> Pull code mới..."
  cd "$APP_DIR" && git pull
else
  if [ -z "$REPO_URL" ]; then
    echo "Lần đầu cần truyền repo URL (kèm token nếu private):"
    echo "  ./deploy.sh https://<TOKEN>@github.com/quytcn-commits/sinhnhat.git"
    exit 1
  fi
  echo ">> Clone repo..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# 2. Tạo .env nếu chưa có
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> Đã tạo .env — NHỚ sửa ADMIN_PASSWORD: nano $APP_DIR/.env"
fi

# 3. Build + chạy
echo ">> Build & up..."
docker compose build
docker compose up -d

# 4. Nginx (lần đầu)
NGINX_CONF="/etc/nginx/sites-available/sinhnhat"
if [ ! -f "$NGINX_CONF" ]; then
  echo ">> Cài nginx config..."
  sudo cp deploy/nginx-sinhnhat.conf "$NGINX_CONF"
  sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/sinhnhat
  sudo nginx -t && sudo systemctl reload nginx
fi

# 5. Kiểm tra
sleep 8
if curl -sf http://127.0.0.1:3003/ > /dev/null; then
  echo "✅ App OK tại http://127.0.0.1:3003"
  echo "✅ Truy cập: https://sinhnhat.newwayrealty.vn (sau khi xong SSL/Cloudflare)"
else
  echo "❌ Chưa sẵn sàng — xem log: docker compose logs -f app"
fi
