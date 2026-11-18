# 部署教程：GitHub Pages + 自己的域名

这份教程对应**本仓库的真实配置**：域名 `070712zz.com`、仓库 `marker404/love-functions`。
全程免费，不需要服务器、数据库或后端。以后如果换域名或换仓库，把这三个名字对应替换即可。

> 官方参考：GitHub 文档《[管理 GitHub Pages 网站的自定义域](https://docs.github.com/zh/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)》与《[用 HTTPS 保护 GitHub Pages](https://docs.github.com/zh/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)》。

---

## 0. 现在到哪一步了

| 项目 | 状态 |
| --- | --- |
| GitHub 仓库 `marker404/love-functions` | ✅ 已创建、已推送过一版 |
| 仓库根目录 `CNAME` 文件 | ✅ 内容为 `070712zz.com` |
| GitHub Pages（main / root） | ✅ 已开启 |
| 自定义域名 | ✅ 已生效 |
| HTTPS 证书 | ✅ 已签发，`https://070712zz.com` 能打开 |
| **推送最新版本** | ⬜ 待办（本地还有新提交没推上去） |
| **Enforce HTTPS** | ⬜ 待办（建议勾选） |

所以现在只需要做两件事：**把新提交 push 上去**，然后在 Pages 设置里**勾选 Enforce HTTPS**（见第 2 节）。

---

## 1. 日常更新：改完代码怎么上线

```powershell
cd "D:\Users\jetey\Desktop\建站\love-functions"   # 仓库所在目录
git status                 # 看看改了哪些文件
git add -A
git commit -m "update: 说明这次改了什么"
git push
```

- 推送后 GitHub Pages 会在 **1～2 分钟**内自动重新部署，可以在仓库的 **Actions** 标签页看进度；
- 浏览器如果还是旧版本，按 `Ctrl + F5` 强制刷新；
- 如果 `git push` 报 `rejected / fetch first`，先 `git pull --rebase origin main` 再 `git push`。

---

## 2. 这次要做的两件事

### 2.1 推送最新版本

```powershell
cd "D:\Users\jetey\Desktop\建站\love-functions"
git push -u origin main
```

推送完成后打开 <https://070712zz.com>，等一两分钟强刷，就能看到「反过来的正弦 E + 通关逐笔动画 + made of functions, deployed with love」。

### 2.2 勾选 Enforce HTTPS

1. 打开仓库 <https://github.com/marker404/love-functions> → **Settings**；
2. 左侧 **Pages**；
3. 找到 **Enforce HTTPS**，勾上（证书已经签发，这里应该可以直接勾）。

勾上之后，`http://070712zz.com` 和 `http://www.070712zz.com` 都会自动跳到 `https://`。

验证：

```powershell
curl.exe -I https://070712zz.com
curl.exe -I http://070712zz.com     # 应该看到 301，并且 Location 是 https://
```

---

## 3. 如果以后要“从零”再部署一次

### 3.1 建仓库并推送

1. 打开 <https://github.com/new>，**Repository name** 填 `love-functions`，**Visibility** 选 **Public**（免费版的 Pages 只支持公开仓库），不要勾 “Add a README file”；
2. 在仓库文件夹里执行：

```powershell
git init
git add -A
git commit -m "feat: LOVE 函数拼字小游戏"
git branch -M main
git remote add origin https://github.com/<你的用户名>/love-functions.git
git push -u origin main
```

（如果本机已经配置过别的仓库，`git remote add` 可能提示已存在，改用 `git remote set-url origin ...`。）

### 3.2 开启 GitHub Pages

仓库 → **Settings → Pages** → **Build and deployment → Source** 选 **Deploy from a branch** → Branch 选 `main`、目录选 `/ (root)` → **Save**。

等 1～2 分钟，默认网址能打开：

```
https://<你的用户名>.github.io/love-functions/
```

> 免费版把仓库改成 Private 后 Pages 会停止发布，网址会 404。

### 3.3 填自定义域名（先填，再配 DNS）

**顺序很重要**：先把域名填进 GitHub，再去域名服务商配置解析。反过来做，域名有被别人抢注（domain takeover）的风险。

1. 仓库 → **Settings → Pages** → **Custom domain**，填 `070712zz.com` → **Save**；
2. （可选但推荐）点 **Verify domain** 验证域名，按提示在 DNS 加一条 `_github-pages-challenge-<用户名>` 的 `TXT` 记录。

保存后 GitHub 会自动在仓库根目录写一个 `CNAME` 文件，内容和自定义域名一致。

### 3.4 在域名服务商配置 DNS

登录买域名的网站（阿里云「云解析 DNS」、腾讯云「DNSPod」、Cloudflare、Namecheap 等），进入 **DNS 解析 / 解析记录**。

`070712zz.com` 是**根域名（裸域）**，根域名不能用 `CNAME`（DNS 规范不允许），要用 `A` 和 `AAAA`：

| 记录类型 | 主机记录（名称） | 记录值 | 说明 |
| --- | --- | --- | --- |
| `A` | `@` | `185.199.108.153` | GitHub Pages |
| `A` | `@` | `185.199.109.153` | GitHub Pages |
| `A` | `@` | `185.199.110.153` | GitHub Pages |
| `A` | `@` | `185.199.111.153` | GitHub Pages |
| `AAAA` | `@` | `2606:50c0:8000::153` | IPv6（可选，官方推荐加） |
| `AAAA` | `@` | `2606:50c0:8001::153` |  |
| `AAAA` | `@` | `2606:50c0:8002::153` |  |
| `AAAA` | `@` | `2606:50c0:8003::153` |  |
| `CNAME` | `www` | `<你的用户名>.github.io` | 让 www 也能打开 |

配置 `www` 之后，GitHub 会自动在根域名和 `www` 之间做 301 跳转。

> 如果以后改用**子域名**（例如 `love.070712zz.com`），那就只需要一条：
> `CNAME` | `love` | `<你的用户名>.github.io`
>
> 注意：`CNAME` 的记录值**不要**带仓库名（不要写成 `<用户名>.github.io/love-functions`），也不要带 `https://`。

几个坑：

- **Cloudflare 用户**：添加记录时先把云朵图标设为 **仅 DNS（灰色云朵）**。橙色云朵（代理）会挡住 GitHub 签发 HTTPS 证书。
- **不要使用通配符记录**（`*.070712zz.com`），有域名被接管的风险。
- 如果域名服务商自动塞了一条默认记录，先删掉再加。

### 3.5 检查 DNS 是否生效

Windows 用 `Resolve-DnsName`（`dig` 是 Linux/macOS 的工具）：

```powershell
Resolve-DnsName 070712zz.com -Type A
Resolve-DnsName 070712zz.com -Type AAAA
Resolve-DnsName www.070712zz.com -Type CNAME

# 换个 DNS 服务器对比
nslookup 070712zz.com 8.8.8.8
```

DNS 生效后，回到 **Settings → Pages**，Custom domain 下面会显示绿色的
`Domain's DNS record successfully configured`；点 **Check again** 可以手动刷新。

DNS 传播最长可能要 24 小时，通常 10 分钟内。

### 3.6 等 HTTPS 证书，勾 Enforce HTTPS

GitHub 会自动为域名申请 Let's Encrypt 证书（通常几分钟，最长 24 小时）。签发后 **Enforce HTTPS** 才可勾选，勾上即可。

如果一直是灰色：

1. 确认 DNS 已经正确指向 GitHub；
2. 把 **Custom domain** 删掉、重新保存一次，触发重新申请；
3. Cloudflare 用户确认云朵是灰色；
4. 再等 10～60 分钟。

---

## 4. 关于 `CNAME` 文件

本仓库根目录已经有 `CNAME`，内容只有一行：

```
070712zz.com
```

要点：

- 文件里**只放域名**：不要 `https://`，不要路径，不要多余空格；
- 必须放在**发布目录的根**（本项目是仓库根目录）；
- 内容必须和 **Settings → Pages → Custom domain** 完全一致，否则 Pages 会报错；
- 换域名时两处一起改，并同步改 DNS 记录。

手动创建/修改：

```powershell
Set-Content -Path CNAME -Value "070712zz.com" -NoNewline -Encoding ascii
git add CNAME
git commit -m "chore: 更新自定义域名"
git push
```

---

## 5. 上线检查清单

- [ ] 仓库是 Public，`main` 分支根目录有 `index.html`
- [ ] Settings → Pages 已开启，默认网址能打开、能玩
- [ ] Custom domain 填写正确，与 `CNAME` 文件内容一致
- [ ] 根域名 `A` / `AAAA`、`www` 的 `CNAME` 都已配置，`Resolve-DnsName` 能查到
- [ ] Pages 页面显示 DNS 配置成功
- [ ] `Enforce HTTPS` 已勾选，`https://070712zz.com` 能打开
- [ ] 手机浏览器竖屏能正常玩
- [ ] 四关都能过，通关动画和「保存这份 LOVE」正常

---

## 6. 常见问题

**Q：打开 `https://<用户名>.github.io/love-functions/` 是 404？**
检查 Settings → Pages 是否开启、分支是不是 `main`、目录是不是 `/ (root)`；刚开启等 1～2 分钟。仓库 Private 且免费计划时不会发布。

**Q：页面能打开但样式/脚本全丢，白底黑字？**
路径问题。本项目所有资源都用**相对路径**（`assets/style.css`），保持 `index.html` 和 `assets/` 的相对位置即可。

**Q：Custom domain 提示 “Domain is already taken”？**
域名被别的仓库占用过。去那个仓库的 Settings → Pages 删掉自定义域名，再回来重试。

**Q：DNS 一直检查不通过？**
① 根域名要用 `A/AAAA`、子域名才用 `CNAME`；② 记录值别带仓库名和协议；③ 检查有没有冲突的旧记录；④ 等 TTL 过期（10 分钟～24 小时）；⑤ 用 `nslookup 070712zz.com 8.8.8.8` 换 DNS 服务器确认。

**Q：`Enforce HTTPS` 灰色 / 证书报错？**
见 3.6。最常见原因是 DNS 还没指向 GitHub，或 Cloudflare 开了橙色代理。

**Q：更新了代码，网站没变化？**
等 1～2 分钟；`Ctrl + F5` 强刷；看 Actions 最近一次部署是否成功；绑了 Cloudflare 代理的话再清一下 Cloudflare 缓存。

**Q：国内访问慢？**
GitHub Pages 服务器在境外，国内访问速度不稳定是网络问题，不是代码问题。项目是纯静态零构建，需要更快可以换 Cloudflare Pages / Vercel / Netlify，拖拽上传即可。

**Q：域名要备案吗？**
网站放在 GitHub Pages（境外服务器）不需要 ICP 备案；迁到境内服务器才需要。

---

## 7. 备选托管

纯静态、零构建，`index.html` 打开就能跑，也可以直接丢给：

- **Cloudflare Pages**：连 GitHub 仓库，构建命令留空，输出目录 `/`；
- **Vercel / Netlify**：选 “Other / 静态站点”，输出目录 `/`；
- 自己的服务器：整个文件夹放进 Nginx 的 `html` 目录。

换托管后，自定义域名在对应平台的设置里绑定，DNS 按平台提示配置即可。
