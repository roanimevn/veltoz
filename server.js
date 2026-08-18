// VeltoZ backend
// -----------------------------------------------------------------------------
// File này là nơi DUY NHẤT giữ API key thật (đọc từ .env, không hardcode trong code).
// Frontend (public/index.html) KHÔNG bao giờ nhìn thấy key này — nó chỉ gọi vào
// route /api/chat của server này, và server mới là bên gọi Anthropic API.
// -----------------------------------------------------------------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'; // model hiện tại của Anthropic API

if (!ANTHROPIC_API_KEY) {
  console.error(
    '[VeltoZ] Thiếu ANTHROPIC_API_KEY. Tạo file .env từ .env.example rồi điền key thật vào trước khi chạy server.'
  );
  process.exit(1);
}

// ----- Middleware -----
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '32kb' })); // giới hạn payload, tránh request quá lớn
app.use(express.static('public')); // phục vụ frontend từ thư mục public/

// Giới hạn số request mỗi IP để tránh key bị lạm dụng nếu có ai đó spam route chat
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 20, // tối đa 20 request/phút/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.' },
});

// ----- Cấu hình prompt riêng cho từng game -----
// Đây là nơi duy nhất định nghĩa "tính cách" VeltoZ theo từng game.
const SYSTEM_PROMPTS = {
  fc: `Bạn là VeltoZ, trợ lý AI chuyên tư vấn về game FC Mobile (bóng đá). 
Trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt. Tập trung vào: đội hình, chemistry, 
chuyển nhượng, chiến thuật thi đấu, nâng cấp cầu thủ. Nếu người dùng hỏi về game khác 
ngoài FC Mobile, hãy nhắc họ chuyển chế độ game ở khung bên trái.`,

  ff: `Bạn là VeltoZ, trợ lý AI chuyên tư vấn về game Free Fire (battle royale). 
Trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt. Tập trung vào: điểm rơi (drop), 
chiến thuật vòng bo, trang bị, kết hợp nhân vật/vật phẩm. Nếu người dùng hỏi về game khác 
ngoài Free Fire, hãy nhắc họ chuyển chế độ game ở khung bên trái.`,

  lq: `Bạn là VeltoZ, trợ lý AI chuyên tư vấn về game Liên Quân Mobile (MOBA). 
Trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt. Tập trung vào: lên đồ, bảng ngọc, 
đi đường, đối kháng tướng, giao tranh. Nếu người dùng hỏi về game khác ngoài Liên Quân, 
hãy nhắc họ chuyển chế độ game ở khung bên trái.`,
};

const VALID_GAMES = Object.keys(SYSTEM_PROMPTS); // ['fc', 'ff', 'lq']

// ----- Route chính: frontend gọi vào đây, KHÔNG gọi thẳng Anthropic API -----
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { game, message, history } = req.body || {};

    // Kiểm tra input cơ bản
    if (!VALID_GAMES.includes(game)) {
      return res.status(400).json({ error: 'Giá trị "game" không hợp lệ. Dùng: fc, ff, hoặc lq.' });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Thiếu nội dung tin nhắn.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Tin nhắn quá dài (tối đa 2000 ký tự).' });
    }

    // Lịch sử hội thoại (tuỳ chọn) do frontend gửi lên, giới hạn số lượng để tránh payload phình to
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
    const messages = [
      ...safeHistory
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      { role: 'user', content: message },
    ];

    // Gọi Anthropic API — key CHỈ tồn tại ở đây, trong bộ nhớ server
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPTS[game],
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[VeltoZ] Lỗi từ Anthropic API:', response.status, errBody);
      return res.status(502).json({ error: 'VeltoZ tạm thời không phản hồi được. Vui lòng thử lại.' });
    }

    const data = await response.json();
    const reply = data.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n') || 'Xin lỗi, VeltoZ chưa có câu trả lời phù hợp lúc này.';

    res.json({ reply });
  } catch (err) {
    console.error('[VeltoZ] Lỗi server:', err);
    res.status(500).json({ error: 'Có lỗi xảy ra phía server. Vui lòng thử lại sau.' });
  }
});

// ----- Route kiểm tra sức khoẻ server -----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'veltoz-backend' });
});

app.listen(PORT, () => {
  console.log(`[VeltoZ] Backend đang chạy tại http://localhost:${PORT}`);
});
