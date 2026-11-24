// ============================================================
// scan-photos.js — 扫描 photos/ 文件夹，生成 photos.json 清单
// 用法：npm run photos（或 start.bat 自动执行）
// 无需安装任何依赖。
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PHOTO_DIR = path.join(ROOT, "photos");
const EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

let names = [];
try {
  names = fs.readdirSync(PHOTO_DIR);
} catch (e) {
  console.warn("photos/ 文件夹不存在，生成空清单");
}

const photos = [];
for (const name of names) {
  if (name.startsWith(".") || name.startsWith("_")) continue;
  const ext = path.extname(name).toLowerCase();
  if (!EXT.has(ext)) continue;
  const abs = path.join(PHOTO_DIR, name);
  let st;
  try { st = fs.statSync(abs); } catch (e) { continue; }
  if (!st.isFile()) continue;
  photos.push({
    name: name.replace(/\.[^.]+$/, ""),
    url: "photos/" + encodeURIComponent(name),
  });
}

photos.sort((a, b) => a.name.localeCompare(b.name, "zh"));

const out = JSON.stringify({ photos }, null, 2) + "\n";
fs.writeFileSync(path.join(ROOT, "photos.json"), out, "utf8");
console.log(`✅ photos.json 已更新：${photos.length} 张照片`);
if (photos.length) console.log(photos.map(p => "   " + p.name).join("\n"));
