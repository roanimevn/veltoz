# VeltoZ Backend

Backend Node.js/Express giữ API key an toàn phía server, phục vụ frontend chat cho VeltoZ
(AI hỗ trợ FC Mobile, Free Fire, Liên Quân Mobile).

## Vì sao cần backend?

Nếu đặt API key trực tiếp trong file HTML/JS chạy trên trình duyệt, bất kỳ ai mở "View Page
Source" đều lấy được key đó. Kiến trúc ở đây tách key ra khỏi frontend:

```
Trình duyệt (public/index.html)
        │  gọi POST /api/chat (không có key)
        ▼
Server (server.js) ── đọc key từ .env ──▶ Anthropic API
```

## Trước khi chạy — QUAN TRỌNG

Ba API key (Claude, Gemini, ChatGPT) đã được dán trực tiếp vào một cuộc trò chuyện trước đó.
Coi như chúng đã lộ:

1. Vào **Anthropic Console** → API Keys → thu hồi key cũ, tạo key mới.
2. (Nếu còn dùng) làm tương tự với Google AI Studio và OpenAI Platform.
3. Chỉ dùng key MỚI cho project này.

## Cài đặt

```bash
cd veltoz-backend
npm install
cp .env.example .env
```

Mở file `.env` vừa tạo, điền key thật của bạn vào:

```
ANTHROPIC_API_KEY=sk-ant-key-moi-cua-ban
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000
```

## Chạy

```bash
npm start
```

Mở trình duyệt tại `http://localhost:3000` — frontend và backend chạy cùng một server nên
không cần cấu hình CORS phức tạp cho local dev.

## Cấu trúc thư mục

```
veltoz-backend/
├── server.js          # Toàn bộ logic backend + route /api/chat
├── package.json
├── .env.example        # Mẫu, không chứa key thật
├── .env                 # Bạn tự tạo, chứa key thật (đã bị .gitignore chặn commit)
├── .gitignore
└── public/
    └── index.html       # Frontend, gọi vào /api/chat, không chứa key
```

## Route API

### `POST /api/chat`

Body:
```json
{
  "game": "fc",              // "fc" | "ff" | "lq"
  "message": "Nên lên đồ gì khi gặp pháp sư?",
  "history": []               // mảng {role, content} tối đa 10 tin nhắn gần nhất (tuỳ chọn)
}
```

Response thành công:
```json
{ "reply": "..." }
```

Response lỗi:
```json
{ "error": "..." }
```

### `GET /api/health`

Dùng để frontend kiểm tra backend còn sống không. Trả về `{ "status": "ok" }`.

## Giới hạn đã có sẵn

- **Rate limit**: tối đa 20 request/phút cho mỗi IP tới `/api/chat`, chống spam làm tốn quota key.
- **Giới hạn độ dài tin nhắn**: tối đa 2000 ký tự mỗi lượt.
- **Giới hạn lịch sử**: chỉ giữ 10 tin nhắn gần nhất gửi lên model, tránh payload phình to.
- **CORS**: chỉ domain khai báo trong `ALLOWED_ORIGIN` mới gọi được backend.

## Triển khai lên production

Khi deploy lên Render/Railway/Fly.io/VPS riêng:

1. **Không** upload file `.env` lên server hay Git. Thay vào đó, khai báo biến môi trường
   `ANTHROPIC_API_KEY` trực tiếp trong bảng điều khiển của nền tảng hosting.
2. Cập nhật `ALLOWED_ORIGIN` thành domain thật (ví dụ `https://veltoz.vn`).
3. Cân nhắc thêm HTTPS (hầu hết nền tảng hosting hiện đại tự cấp sẵn).
4. Cân nhắc thêm xác thực người dùng (đăng nhập) nếu muốn giới hạn ai được chat, để bảo vệ
   quota API key kỹ hơn nữa.
