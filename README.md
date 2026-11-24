# 一个小网站

> 还能找到这里？找到就狠狠抱抱
> 纯 HTML / CSS / JavaScript，无框架、无构建、无依赖，部署在 GitHub Pages。



![首页](docs/screenshot-home.png)

## 作品

| 作品 | 地址 | 状态 | 说明 |
| --- | --- | --- | --- |
| **LOVE · 函数拼字** | [/love-functions/](love-functions/) | 已上线 | 选函数、调参数，用反函数、圆、二次函数和竖起来的正弦拼出 LOVE |
| **圣诞小屋** | [/xmas-cabin/](xmas-cabin/) | 已上线 | 线稿风小木屋，圣诞树、彩灯、雪人、礼物，能走进去逛 |
| **圣诞树 · 手势粒子** | [/christmas-tree/](christmas-tree/) | 开发中 | 摄像头手势操控的 28000 粒子圣诞树，照片能挂上树，完全离线可用（模型加载优化中，暂不开放） |
| **抱抱小屋** | /hug/ | 筹备中 | 点一下，就有一个抱抱的页面 |
| 保密 | /…/ | 空位 | 下一个小玩意 |

首页是仓库根目录的 `index.html`，负责把作品串起来；每个作品都放在自己的文件夹里，互不影响。

## 目录结构

```
/                        ← 首页（作品索引）
├─ index.html
├─ assets/
│  ├─ home.css            ← 首页样式
│  ├─ home.js             ← 首页交互（滚动淡入 + 首屏曲线动画）
│  ├─ favicon.svg
│  ├─ preview-love.png    ← LOVE 卡片预览图
│  └─ preview-xmas.jpg    ← 圣诞小屋卡片预览图
├─ love-functions/        ← 作品：LOVE 函数拼字（有自己的 README）
├─ xmas-cabin/            ← 作品：圣诞小屋（取自 MIT 的线稿小屋，见 CREDITS.md）
├─ christmas-tree/        ← 作品：手势粒子圣诞树（Three.js + MediaPipe，依赖全部本地化）
├─ hug/                   ← 作品：抱抱小屋（规划中）
├─ CNAME                  ← 自定义域名 070712zz.com
├─ .nojekyll              ← 让 GitHub Pages 跳过 Jekyll
├─ DEPLOY.md              ← 部署教程（GitHub Pages + 域名 + HTTPS）
├─ ROADMAP.md             ← 规划：想做哪些页面、怎么排期
├─ README.md
└─ LICENSE
```

## 本地预览（我觉得你也不会哈哈哈，给想模仿的人看的）

在**仓库根目录**双击 `start.bat`（或运行 `node server.js`），它会起一个本地服务器并打开：

- 首页：<http://127.0.0.1:8080/>
- 函数拼字：<http://127.0.0.1:8080/love-functions/>
- 圣诞树：<http://127.0.0.1:8080/christmas-tree/>

不想用 Node 也可以 `python -m http.server 8000`，效果一样。

> 注意：圣诞树用了 ES Module + WASM，**必须通过 HTTP 打开**；直接双击 `index.html` 浏览器会拒绝加载模块。部署到 GitHub Pages 后走线上地址就没这个问题。

## 加一个新作品

约定很简单：

1. 新建一个文件夹（比如 `hug/`），里面放 `index.html` 和它自己的 `assets/`；
2. 页面里所有资源都用**相对路径**（`assets/xxx.css`、`../` 回首页），不要写 `/assets/...`，这样 GitHub 项目页和自定义域名都能用；
3. 在根目录 `index.html` 的 `.cards` 里加一张卡片，链到那个文件夹；
4. 更新本 README 的「作品」表、`ROADMAP.md` 的状态；
5. `git add -A && git commit -m "feat: xxx" && git push`，等 1～2 分钟自动上线。

样式可以照抄首页或 `love-functions/` 的 CSS 变量（颜色、字体、圆角），但**每个作品保留自己的样式文件**，避免以后改一个页面影响另一个。

## 部署

整个小站就是一个仓库。
从仓库、Pages、自定义域名、DNS 记录到 HTTPS 的完整步骤见 **[DEPLOY.md](DEPLOY.md)**。

日常更新：

```powershell
git add -A
git commit -m "update: 说明改了什么"
git push
```

## License

MIT，见 [LICENSE](LICENSE)。
