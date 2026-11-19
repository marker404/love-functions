# 070712 · 小站

> 一个自己维护的小地方：想到什么就做出来放在这里。
> 纯 HTML / CSS / JavaScript，无框架、无构建、无依赖，部署在 GitHub Pages。

在线：<https://070712zz.com/>

![首页](docs/screenshot-home.png)

## 作品

| 作品 | 地址 | 状态 | 说明 |
| --- | --- | --- | --- |
| **LOVE · 函数拼字** | [/love-functions/](love-functions/) | 已上线 | 选函数、调参数，用反函数、圆、二次函数和竖起来的正弦拼出 LOVE |
| **抱抱小屋** | /hug/ | 筹备中 | 点一下，就有一个抱抱的页面 |
| 待定 | /…/ | 空位 | 下一个小玩意 |

首页是仓库根目录的 `index.html`，负责把作品串起来；每个作品都放在自己的文件夹里，互不影响。

## 目录结构

```
/                        ← 首页（作品索引）
├─ index.html
├─ assets/
│  ├─ home.css            ← 首页样式
│  ├─ home.js             ← 首页交互（滚动淡入 + 首屏曲线动画）
│  ├─ favicon.svg
│  └─ preview-love.png    ← LOVE 卡片预览图
├─ love-functions/        ← 作品：LOVE 函数拼字（有自己的 README）
├─ hug/                   ← 作品：抱抱小屋（规划中）
├─ CNAME                  ← 自定义域名 070712zz.com
├─ .nojekyll              ← 让 GitHub Pages 跳过 Jekyll
├─ DEPLOY.md              ← 部署教程（GitHub Pages + 域名 + HTTPS）
├─ ROADMAP.md             ← 规划：想做哪些页面、怎么排期
├─ README.md
└─ LICENSE
```

## 本地预览

在**仓库根目录**起一个静态服务器（不是在子文件夹里）：

```powershell
cd "D:\Users\jetey\Desktop\建站\love-functions"
python -m http.server 8000
```

然后打开：

- 首页：<http://localhost:8000/>
- 函数拼字：<http://localhost:8000/love-functions/>

单个作品也可以直接双击它文件夹里的 `index.html` 打开。

## 加一个新作品

约定很简单：

1. 新建一个文件夹（比如 `hug/`），里面放 `index.html` 和它自己的 `assets/`；
2. 页面里所有资源都用**相对路径**（`assets/xxx.css`、`../` 回首页），不要写 `/assets/...`，这样 GitHub 项目页和自定义域名都能用；
3. 在根目录 `index.html` 的 `.cards` 里加一张卡片，链到那个文件夹；
4. 更新本 README 的「作品」表、`ROADMAP.md` 的状态；
5. `git add -A && git commit -m "feat: xxx" && git push`，等 1～2 分钟自动上线。

样式可以照抄首页或 `love-functions/` 的 CSS 变量（颜色、字体、圆角），但**每个作品保留自己的样式文件**，避免以后改一个页面影响另一个。

## 部署

整个小站就是一个仓库，用 GitHub Pages 发布，域名 `070712zz.com`。
从仓库、Pages、自定义域名、DNS 记录到 HTTPS 的完整步骤见 **[DEPLOY.md](DEPLOY.md)**。

日常更新：

```powershell
git add -A
git commit -m "update: 说明改了什么"
git push
```

## License

MIT，见 [LICENSE](LICENSE)。
