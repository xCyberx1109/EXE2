# F&B Store Backend API

Backend REST API cho hệ thống quản lý cửa hàng F&B, phục vụ frontend React (Menu, Tồn kho, Doanh thu, POS).

## Công nghệ

- Node.js + Express.js
- MySQL + Prisma ORM
- JWT Authentication
- bcrypt, cors, morgan, dotenv, express-validator

## Cấu trúc thư mục

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # npm run seed
├── src/
│   ├── config/            # Cấu hình app
│   ├── controllers/       # Controller tổng hợp (dashboard)
│   ├── middlewares/       # Auth, validate, error handler
│   ├── modules/           # auth, menu, inventory, revenue, orders
│   ├── repositories/      # Data access layer
│   ├── routes/            # Route aggregator
│   ├── seed/              # Seed data & logic
│   ├── utils/             # Helpers, mappers, AppError
│   ├── validators/        # express-validator rules
│   ├── app.js
│   └── server.js
├── .env.example
└── package.json
```

## Yêu cầu

- Node.js >= 18
- MySQL 8.x

## Cài đặt & chạy

### 1. Cài dependencies

```bash
cd backend
npm install
```

### 2. Cấu hình database

Tạo database MySQL:

```sql
CREATE DATABASE fnb_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy và chỉnh `.env`:

```bash
cp .env.example .env
```

Sửa `DATABASE_URL` trong `.env`:

```
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/fnb_store"
```

### 3. Migration

```bash
npm run db:migrate
```

Lần đầu nhập tên migration, ví dụ: `init`

### 4. Seed dữ liệu mẫu

```bash
npm run seed
```

Tạo sẵn:
- Admin: `admin@store.com` / `Admin@123`
- Staff: `staff@store.com` / `Staff@123`
- Categories, menu items, inventory, orders, revenue reports

### 5. Chạy development

```bash
npm run dev
```

Server: `http://localhost:3001`

> Khi `AUTO_SEED_ON_START=true`, server tự seed nếu database trống.

## Kết nối Frontend

Thêm vào `frontend/.env`:

```
VITE_API_URL=http://localhost:3001/api
```

Cho POS (đã có sẵn trong code):

```
VITE_API_URL=http://localhost:3001
```

POS gọi `${VITE_API_URL}/orders` → `http://localhost:3001/orders` (legacy endpoint).

## API Endpoints

### Auth

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Profile (Bearer token) |

### Menu (khớp `MenuManagement.tsx`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/menu-items?search=&category=&available=` | Danh sách món |
| GET | `/api/menu-items/top-selling` | Top bán chạy |
| GET | `/api/menu-items/:id` | Chi tiết món |
| POST | `/api/menu-items` | Thêm món 🔒 |
| PUT | `/api/menu-items/:id` | Sửa món 🔒 |
| PATCH | `/api/menu-items/:id/availability` | Bật/tắt bán 🔒 |
| DELETE | `/api/menu-items/:id` | Xóa món 🔒 |
| GET | `/api/categories` | Danh mục |
| POST/PUT/DELETE | `/api/categories` | CRUD danh mục 🔒 |

### Inventory (khớp `InventoryManagement.tsx`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/ingredients?search=&lowStock=true` | Danh sách |
| GET | `/api/ingredients/low-stock` | Cảnh báo hết hàng |
| GET | `/api/ingredients/stats` | Thống kê kho |
| POST | `/api/ingredients/:id/stock-in` | Nhập kho 🔒 |
| POST | `/api/ingredients/:id/stock-out` | Xuất kho 🔒 |
| GET | `/api/ingredients/:id/transactions` | Lịch sử |

### Revenue (khớp `RevenueManagement.tsx`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/revenue/daily?range=7days\|14days\|30days` | Báo cáo theo ngày |
| GET | `/api/revenue/summary?range=14days` | Tổng hợp |
| GET | `/api/revenue/stats?period=day\|month\|year` | Theo kỳ |
| GET | `/api/revenue/top-items?limit=10` | Top món |
| GET | `/api/revenue/overview` | Dashboard |
| GET | `/api/dashboard` | Tổng quan |

### Orders - POS (khớp `POSSystem.tsx`)

| Method | Endpoint | Format |
|--------|----------|--------|
| GET | `/orders` | Legacy - mảng JSON thuần |
| POST | `/orders` | Legacy - tạo đơn |
| DELETE | `/orders/:id` | Legacy - xóa đơn |
| GET | `/api/orders` | Chuẩn `{ success, data }` |

🔒 = Cần header `Authorization: Bearer <token>`

## Response format

**Thành công:**
```json
{
  "success": true,
  "message": "Thành công",
  "data": {}
}
```

**Lỗi:**
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "error": {}
}
```

## Ví dụ gọi API

### Đăng nhập

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@store.com","password":"Admin@123"}'
```

### Lấy menu (public)

```bash
curl "http://localhost:3001/api/menu-items?category=Món chính&search=phở"
```

### Tạo món (cần token)

```bash
curl -X POST http://localhost:3001/api/menu-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Phở Gà",
    "category": "Món chính",
    "price": 60000,
    "cost": 32000,
    "description": "Phở gà ta",
    "available": true
  }'
```

## Scripts

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Chạy với nodemon |
| `npm start` | Production |
| `npm run seed` | Seed database |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:deploy` | Migrate production |
| `npm run db:studio` | Prisma Studio UI |

## Database Schema

- **users** - admin, staff
- **categories** → **menu_items**
- **ingredients** ↔ **menu_item_ingredients**
- **inventory_transactions** - nhập/xuất kho
- **orders** → **order_items**
- **revenue_reports** - báo cáo theo ngày

## Ghi chú tích hợp Frontend

Dữ liệu API được map khớp `mockData.ts`:

| Frontend field | API field |
|----------------|-----------|
| `MenuItem.category` | `category` (tên danh mục) |
| `InventoryItem.lastUpdated` | `YYYY-MM-DD` |
| `RevenueRecord` | `/api/revenue/daily` |
| `foodOrderStats` | `/api/menu-items/top-selling` |

POS hiện dùng endpoint legacy `/orders` — không cần đổi code POS nếu set `VITE_API_URL=http://localhost:3001`.
