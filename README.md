# 🖼️ Image & Video — Low Resolution + Watermark

Ứng dụng web giúp **giảm resolution**, **nén chất lượng** và **chèn watermark/logo** tự động cho ảnh và video.  
Hỗ trợ xử lý hàng loạt, tải về dạng file đơn hoặc ZIP.

---

## 🗂️ Cấu trúc dự án

```
Image-Low-Resolution-Watermark/
├── client/          # Frontend — Vue 3 + Vite + Pinia
│   ├── src/
│   │   ├── components/   # ImageUploader, VideoUploader, PreviewGrid, WatermarkUploader...
│   │   ├── stores/       # imageStore.js, videoStore.js
│   │   └── services/     # api.js (axios)
│   ├── vite.config.js
│   └── package.json
│
└── server/          # Backend — Node.js + Express
    ├── server.js
    ├── assets/           # watermark.png mặc định
    ├── public/uploads/   # thư mục lưu file tạm (tự tạo)
    ├── src/
    │   ├── config/       # db.js (PostgreSQL)
    │   ├── controllers/  # imageController.js, videoController.js
    │   ├── middleware/    # upload.js (multer)
    │   ├── models/       # history.js
    │   ├── routes/       # imageRoutes.js, videoRoutes.js
    │   ├── services/     # imageService.js (sharp), videoService.js (ffmpeg)
    │   └── utils/        # zipHelper.js
    ├── .env.example
    └── package.json
```

---

## ⚙️ Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---------|-------------------|
| Node.js | 18+ |
| npm     | 9+  |
| PostgreSQL | 14+ |

> **ffmpeg** và **ffprobe** đã được bundle sẵn qua `ffmpeg-static` và `ffprobe-static` — **không cần cài thêm**.

---

## 🚀 Cài đặt & Chạy

### 1. Clone repo

```bash
git clone https://github.com/phuocnnt464/Image-Low-Resolution-Watermark.git
cd Image-Low-Resolution-Watermark
```

---

### 2. Cài đặt Server

```bash
cd server
npm install
```

#### Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền thông tin:

```dotenv
PORT=3000
NODE_ENV=development

# Upload
MAX_FILE_SIZE=50
UPLOAD_DIR=./public/uploads
WATERMARK_PATH=./assets/watermark.png
```

#### Chạy server

```bash
# Development (tự reload khi sửa code)
npm run dev

# Production
npm start
```

> Server chạy tại: `http://localhost:3000`

---

### 3. Cài đặt Client

Mở terminal mới:

```bash
cd client
npm install
```

#### Chạy client

```bash
# Development
npm run dev
```

> Client chạy tại: `http://localhost:5173`  
> Mọi request `/api/*` sẽ tự động proxy sang `http://localhost:3000`

---

### 4. Chạy song song (2 terminal)

**Terminal 1 — Server:**
```bash
cd server && npm run dev
```

**Terminal 2 — Client:**
```bash
cd client && npm run dev
```

Mở trình duyệt: **http://localhost:5173**

---

## 📦 Build Production

```bash
cd client
npm run build
```

File tĩnh sẽ được tạo trong `client/dist/`.  
Có thể serve thông qua nginx hoặc Express static.

#### Preview bản build trước khi deploy

```bash
cd client
npm run preview
```

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/images/process` | Xử lý ảnh: giảm resolution + chèn watermark |
| `GET`  | `/api/images/history` | Lấy lịch sử xử lý ảnh |
| `DELETE` | `/api/images/history/:id` | Xóa một bản ghi lịch sử |
| `POST` | `/api/videos/process` | Xử lý video: giảm bitrate + chèn watermark |

### POST `/api/images/process` — Form Data

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `images` | `File[]` | Ảnh cần xử lý (JPG/PNG/WEBP, tối đa 20 ảnh, 50MB/ảnh) |
| `resolutionPreset` | `string` | `Original` \| `4K` \| `QHD` \| `FHD` \| `HD` \| `SD` \| `LD` \| `Tiny` |
| `watermarkPosition` | `string` | `top-left` \| `top-center` \| `top-right` \| `center-left` \| `center` \| `center-right` \| `bottom-left` \| `bottom-center` \| `bottom-right` |
| `watermark` | `File` _(tuỳ chọn)_ | Logo tuỳ chỉnh (PNG/WEBP có alpha) |

### POST `/api/videos/process` — Form Data

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `video` | `File` | Video cần xử lý (MP4/MOV/AVI/MKV/WEBM, tối đa 2GB) |
| `bitratePreset` | `string` | `Original` \| `4K` \| `1080p` \| `720p` \| `480p` \| `360p` \| `240p` |
| `videoBitrate` | `string` | `auto` hoặc giá trị cụ thể theo preset (vd: `8000k`, `4000k`) |
| `watermarkPosition` | `string` | Vị trí logo (xem bảng trên) |
| `watermark` | `File` _(tuỳ chọn)_ | Logo tuỳ chỉnh |

---

## 🎛️ Resolution Presets — Ảnh

| Preset | Max Width × Height | Ghi chú |
|--------|--------------------|---------|
| `Original` | Giữ nguyên | Không resize |
| `4K` | 3840 × 2160 | Ultra HD |
| `QHD` | 2560 × 1440 | Quad HD |
| `FHD` | 1920 × 1080 | Full HD |
| `HD` | 1280 × 720 | HD |
| `SD` | 854 × 480 | Standard |
| `LD` | 480 × 270 | Low Definition |
| `Tiny` | 240 × 135 | Cực thấp |

> Dùng `fit: 'inside'` + `withoutEnlargement: true` — giữ tỉ lệ gốc, không phóng to.

---

## 📡 Bitrate Presets — Video

| Preset | Scale Width | Bitrate có thể chọn |
|--------|-------------|---------------------|
| `Original` | Giữ nguyên | auto |
| `4K` | 3840px | auto / 40 Mbps / 20 Mbps / 10 Mbps |
| `1080p` | 1920px | auto / 12 Mbps / 8 Mbps / 4 Mbps |
| `720p` | 1280px | auto / 6 Mbps / 4 Mbps / 2 Mbps |
| `480p` | 854px | auto / 3 Mbps / 2 Mbps / 1 Mbps |
| `360p` | 640px | auto / 1.5 Mbps / 1 Mbps / 600 Kbps |
| `240p` | 426px | auto / 700 Kbps / 500 Kbps / 300 Kbps |

> `auto` = dùng CRF (chất lượng cố định).  
> Chọn bitrate cụ thể = file có kích thước dự đoán được (CBR-like).

---

## 🛠️ Scripts tóm tắt

| Lệnh | Thư mục | Mô tả |
|------|---------|-------|
| `npm install` | `server/` hoặc `client/` | Cài dependencies |
| `npm run dev` | `server/` | Chạy server với nodemon |
| `npm start` | `server/` | Chạy server production |
| `npm run dev` | `client/` | Chạy Vite dev server |
| `npm run build` | `client/` | Build production |
| `npm run preview` | `client/` | Preview bản build |

---

## 🐛 Troubleshooting

**Lỗi kết nối database:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ Kiểm tra PostgreSQL đang chạy và thông tin `.env` đúng.

**Lỗi `sharp` khi cài trên Linux/Mac M1:**
```bash
npm install --ignore-scripts=false
# hoặc
npm rebuild sharp
```

**Port 3000 hoặc 5173 đã bị dùng:**  
Đổi `PORT` trong `server/.env` và `server.port` trong `client/vite.config.js`.

**Thư mục `public/uploads` không tồn tại:**
```bash
cd server && mkdir -p public/uploads
```