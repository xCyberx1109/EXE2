# POS System + QR Menu (React + Vite + JSON Server)

Hệ thống POS đơn giản cho nhà hàng / quán ăn cho phép:

* Nhân viên chọn bàn và tạo order
* Khách hàng quét QR để xem menu và đặt món
* POS nhận order từ QR theo thời gian thực
* Thanh toán và xóa order sau khi hoàn tất

---

# 1. Yêu cầu hệ thống

Cài đặt:

* Node.js (>= 18)
* npm

Kiểm tra:

```bash
node -v
npm -v
```

---

# 2. Cài đặt project

Clone repository:

```bash
git clone <repo-url>
cd <project-folder>
```

Cài dependencies:

```bash
npm install
```

---

# 3. Cấu hình môi trường

Tạo file `.env` ở root project.

Ví dụ:

```
VITE_API_URL=http://localhost:3001
VITE_FRONTEND_URL=http://192.168.0.113:5173
```

Lưu ý:

* Vite yêu cầu biến môi trường phải bắt đầu bằng `VITE_`
* Sửa ip của VITE_FRONTEND_URL thành ip của máy mình có thể lấy khi chạy project

---

# 4. Chạy JSON Server

Project sử dụng **json-server** để giả lập backend.

Chạy server:

```bash
npx json-server --watch db.json --port 3001
```

API sẽ chạy tại:

```
http://localhost:3001
```

---

# 5. Chạy Frontend

Khởi động Vite:

```bash
npm run dev -- --host
```

Server sẽ hiển thị:

```
Local:   http://localhost:5173
Network: http://192.168.x.x:5173
```

**Sử dụng địa chỉ Network để điện thoại truy cập.**

---

# 6. Sử dụng QR Menu

Trong trang POS, mỗi bàn sẽ có một QR Code.

Khách hàng có thể:

1. Quét QR bằng điện thoại
2. Mở menu
3. Chọn món và gửi order

Order sẽ được lưu vào `db.json` và POS sẽ tự động cập nhật.

---

# 9. Cấu trúc project

```
project
│
├── src
│   ├── components
│   ├── pages
│   ├── data
│   └── ...
│
├── db.json
├── .env
├── package.json
└── README.md
```

---

# 10. Lưu ý khi dùng QR

* Máy tính và điện thoại phải cùng WiFi
* Sử dụng **Network URL** của Vite để truy cập
* Nếu không truy cập được, kiểm tra firewall
* 
---

# 11. Công nghệ sử dụng

* React
* Vite
* TypeScript
* TailwindCSS
* json-server
* QRCode.react

