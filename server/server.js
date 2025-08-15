// server/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import QRCode from "qrcode";

dotenv.config();
const app = express();

// ====== ENV ======
const PORT = Number(process.env.SERVER_PORT || 5174);
const PIX_KEY = (process.env.PIX_KEY || "").trim();              // sua chave Pix (tel/email/aleatória)
const PIX_MERCHANT = (process.env.PIX_MERCHANT || "Cubo Criativo");
const PIX_CITY = (process.env.PIX_CITY || "Barreiras");

// ====== Helpers ======
function sanitizeAscii(str, max) {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase()
    .slice(0, max);
}
const NAME = sanitizeAscii(PIX_MERCHANT, 25);
const CITY = sanitizeAscii(PIX_CITY, 15);

function emv(tag, value) {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}
function crc16(payload) {
  let pol = 0x1021, res = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    res ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      res = (res & 0x8000) ? ((res << 1) ^ pol) : (res << 1);
      res &= 0xffff;
    }
  }
  return res.toString(16).toUpperCase().padStart(4, "0");
}
function buildPixPayload({ key, name, city, amount, description, txid }) {
  const _00 = emv("00", "01");
  const _01 = emv("01", "12"); // estático
  const _26 = emv("26",
    emv("00", "br.gov.bcb.pix") +
    emv("01", key) +
    (description ? emv("02", String(description).substring(0, 50)) : "")
  );
  const _52 = emv("52", "0000");
  const _53 = emv("53", "986");
  const _54 = amount ? emv("54", Number(amount).toFixed(2)) : "";
  const _58 = emv("58", "BR");
  const _59 = emv("59", name);
  const _60 = emv("60", city);
  const _62 = emv("62", emv("05", String(txid).substring(0, 25)));
  const semCRC = `${_00}${_01}${_26}${_52}${_53}${_54}${_58}${_59}${_60}${_62}6304`;
  const _63 = crc16(semCRC);
  return semCRC + _63;
}

// ====== Middlewares ======
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "OPTIONS"],
}));
app.use(express.json({ limit: "1mb" }));

// ====== Healthcheck ======
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, port: PORT });
});

// ====== Pix estático ======
app.post("/api/pix/create", async (req, res) => {
  try {
    if (!PIX_KEY) return res.status(400).json({ ok: false, error: "PIX_KEY não configurada no .env" });

    const amount = Number(req.body?.amount);
    const description = req.body?.description || "Cubo Criativo";
    const txid = ("CUBO" + Date.now()).slice(0, 25); // alfanumérico

    const payload = buildPixPayload({
      key: PIX_KEY,
      name: NAME,
      city: CITY,
      amount: isFinite(amount) && amount > 0 ? amount : undefined,
      description,
      txid,
    });

    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, scale: 6 });
    res.json({ ok: true, txid, payload, qrDataUrl });
  } catch (err) {
    console.error("Erro /api/pix/create:", err);
    res.status(500).json({ ok: false, error: "Falha ao gerar QR" });
  }
});

// 404 + start
app.use("*", (_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
app.listen(PORT, () => console.log(`PIX server on http://localhost:${PORT}`));
