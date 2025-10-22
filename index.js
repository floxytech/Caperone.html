import express from "express";
import helmet from "helmet";
import cors from "cors";
import { body, validationResult } from "express-validator";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50kb" }));

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const CONTACT_FILE = path.join(DATA_DIR, "contacts.json");

app.get("/api/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.post("/api/quote",
  body("origin").notEmpty(),
  body("destination").notEmpty(),
  body("weight").isFloat({ gt: 0 }),
  body("mode").isIn(["sea", "air"]),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const { weight, mode } = req.body;
    const base = mode === "air" ? 1.8 : 0.5;
    const estimate = Math.max(50, Math.round(base * weight * 10));
    res.json({ ok: true, estimate, currency: "KSH" });
  }
);

app.post("/api/contact",
  body("name").notEmpty(),
  body("email").isEmail(),
  body("message").isLength({ min: 3 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const entry = { ...req.body, receivedAt: new Date().toISOString() };
    try {
      const existing = fs.existsSync(CONTACT_FILE) ? JSON.parse(fs.readFileSync(CONTACT_FILE)) : [];
      existing.push(entry);
      fs.writeFileSync(CONTACT_FILE, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.error("File write failed:", err.message);
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
          subject: `Caperone Contact: ${req.body.name}`,
          text: req.body.message
        });
      } catch (err) {
        console.error("Email failed:", err.message);
      }
    }
    res.json({ ok: true, message: "Received" });
  }
);

app.get("*", (req, res) => {
  const file = path.join(__dirname, "public", "caperone.html");
  fs.existsSync(file) ? res.sendFile(file) : res.status(404).send("Not found");
});

export default app;
