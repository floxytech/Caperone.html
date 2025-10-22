import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import fs from "fs";
import path from "path";
import { body, validationResult } from "express-validator";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Upload route
app.post("/api/upload", upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ ok: true, file: fileUrl });
});

// Contact route
app.post("/api/contact", [
  body("name").notEmpty(),
  body("email").isEmail(),
  body("message").isLength({ min: 5 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { name, email, message } = req.body;
  const filePath = path.join(__dirname, "contacts.json");
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : [];
  existing.push({ name, email, message, date: new Date().toISOString() });
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

  res.json({ ok: true, message: "Message received" });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Caperone running on port ${PORT}`));
