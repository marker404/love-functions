// ============================================================
// 站点本地预览服务器（仅本地用，GitHub Pages 不需要）
// 用法：双击根目录 start.bat，或 node server.js
// 打开 http://127.0.0.1:8080/
// ============================================================
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
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
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch (e) {
    urlPath = "/";
  }
  if (!urlPath.startsWith("/")) urlPath = "/" + urlPath;

  let fp = path.resolve(ROOT, "." + urlPath);
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(fp, (err, st) => {
    if (!err && st.isDirectory()) {
      // 目录没带斜杠时先补斜杠，和 GitHub Pages 行为一致
      if (!urlPath.endsWith("/")) {
        res.writeHead(301, { Location: urlPath + "/" });
        res.end();
        return;
      }
      fp = path.join(fp, "index.html");
    }

    fs.readFile(fp, (e2, data) => {
      if (e2) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found: " + urlPath);
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("✅ 站点预览：http://127.0.0.1:8080/");
  console.log("   首页 /love-functions/ /xmas-cabin/ /christmas-tree/");
  console.log("   Ctrl+C 结束");
});
