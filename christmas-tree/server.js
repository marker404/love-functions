const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5173;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".tgz": "application/gzip",
};
const PHOTO_DIR = path.join(ROOT, "photos");
const PHOTO_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

/** 扫描 photos/ 文件夹里的图片，作为「自动上树」的照片列表 */
function scanPhotos() {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(PHOTO_DIR); } catch (e) { return out; }
  for (const name of names) {
    if (name.startsWith(".") || name.startsWith("_")) continue;
    const ext = path.extname(name).toLowerCase();
    if (!PHOTO_EXT.has(ext)) continue;
    const abs = path.join(PHOTO_DIR, name);
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) continue;
      const base = name.replace(/\.[^.]+$/, "");
      out.push({
        name: base,
        url: "photos/" + encodeURIComponent(name),   // 相对页面路径，子目录部署也能用
        mtime: st.mtimeMs,
      });
    } catch (e) { /* 跳过无法读取的文件 */ }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return out;
}

const server = http.createServer((req, res) => {
  // 统一解码 URL（支持中文文件名），去掉查询串
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || "/").split("?")[0]); }
  catch (e) { urlPath = req.url || "/"; }
  if (urlPath === "/") urlPath = "/index.html";

  // API：列出根目录图片
  if (urlPath === "/api/photos") {
    const body = JSON.stringify({ photos: scanPhotos() });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
    return;
  }

  // 静态文件：限制在根目录内，防止路径穿越
  const fp = path.resolve(ROOT, "." + urlPath);
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }
  const ext = path.extname(fp).toLowerCase();
  const ctype = MIME[ext] || "application/octet-stream";
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": ctype });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://127.0.0.1:${PORT}`);
  const n = scanPhotos().length;
  console.log(`🖼️  photos/ 检测到 ${n} 张图片，将自动挂到树上`);
});
