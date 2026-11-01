const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const META_FILE = path.join(DATA_DIR, "files.json");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "[]");

const readFiles = () => JSON.parse(fs.readFileSync(META_FILE, "utf8"));
const writeFiles = (items) => fs.writeFileSync(META_FILE, JSON.stringify(items, null, 2));

app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 15);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

app.get("/api/files", (_req, res) => {
  const items = readFiles().map(({ id, name, size, type, uploadedAt }) =>
    ({ id, name, size, type, uploadedAt, url: `/api/files/${id}/content` }));
  res.json(items);
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please choose a file." });
  const items = readFiles();
  const record = {
    id: req.file.filename,
    name: path.basename(req.file.originalname),
    storedName: req.file.filename,
    size: req.file.size,
    type: req.file.mimetype || "application/octet-stream",
    uploadedAt: new Date().toISOString()
  };
  items.unshift(record);
  writeFiles(items);
  res.status(201).json({ message: "File uploaded.", file: {
    id: record.id, name: record.name, size: record.size, type: record.type,
    uploadedAt: record.uploadedAt, url: `/api/files/${record.id}/content`
  }});
});

app.get("/api/files/:id/content", (req, res) => {
  const item = readFiles().find(f => f.id === req.params.id);
  if (!item) return res.status(404).send("File not found.");
  const filePath = path.join(UPLOAD_DIR, item.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).send("File is missing.");
  res.setHeader("Content-Type", item.type || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ error: "Maximum file size is 50 MB." });
  res.status(400).json({ error: err.message || "Upload failed." });
});

app.listen(PORT, () => console.log(`FileHub running at http://localhost:${PORT}`));