# 部署教程：GitHub Pages + 自己的域名

这份教程把「本地能玩的游戏」变成「`https://你的域名` 上能玩的网站」。全程免费，不需要服务器、数据库或后端。
整个过程大约 10 分钟，其中等 DNS 和 HTTPS 证书可能需要更久（最长 24 小时，通常几分钟）。

> 官方参考：GitHub 文档《[管理 GitHub Pages 网站的自定义域](https://docs.github.com/zh/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)》与《[保护 GitHub Pages 网站](https://docs.github.com/zh/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)》。

---

## 0. 你需要准备

- 一个 **GitHub 账号**（免费版即可；免费版要求仓库是 **Public**，私有仓库的 Pages 需要付费计划）。
- 一个**自己的域名**（已解析到你购买它的服务商，例如阿里云 / 腾讯云 / Cloudflare / Namecheap 等）。
- 本仓库的所有文件（就是你手上这个文件夹）。
- 一台装了 Git 的电脑（没有 Git 也可以用网页手动上传，见 1.2 的 B 方案）。

先决定域名用哪种形式，后面 DNS 记录不一样：

| 形式 | 例子 | DNS 记录 | 推荐度 |
| --- | --- | --- | --- |
| 子域名 | `love.example.com` | 一条 `CNAME` | ⭐ 最省事，推荐 |
| 根域名（裸域） | `example.com` | 4 条 `A` + 4 条 `AAAA` | 也行，记录多几条 |
| 根域名 + www | `example.com` + `www.example.com` | 上面的 A/AAAA + `www` 的 CNAME | 官方推荐 |

> 下文统一用 `love.example.com`（把 `example.com` 换成你自己的域名，`love` 可以换成任意子域名）。

---

## 1. 创建 GitHub 仓库并推送

### 1.1 新建空仓库

浏览器打开 <https://github.com/new>：

- **Repository name**：比如 `love-functions`（名字随意，后面会出现在默认网址里）。
- **Visibility**：选 **Public**。
- 不要勾选 “Add a README file”（我们本地已经有 README 了）。
- 点 **Create repository**，复制页面上给出的仓库地址，形如：
  `https://github.com/<你的用户名>/love-functions.git`

### 1.2 推送本地代码

**A 方案：命令行（推荐）**

在仓库文件夹（就是有 `index.html` 的这一层）打开 PowerShell：

```powershell
cd "D:\Users\jetey\Desktop\建站\love-functions"   # 改成你自己的路径
git init
git add -A
git commit -m "feat: LOVE 函数拼字小游戏"
git branch -M main
git remote add origin https://github.com/<你的用户名>/love-functions.git
git push -u origin main
```

第一次推送会弹出浏览器登录 GitHub，按提示授权即可。

**B 方案：网页上传（不想装 Git 时）**

1. 在新建好的仓库页面点 **Add file → Upload files**；
2. 把 `index.html`、`assets/`、`README.md` 等拖进去（注意保持文件夹结构）；
3. 填提交说明，点 **Commit changes**。

> 说明：`docs/` 里只是 README 用的截图，`tools/` 只是本地测试脚本，都可以一起传；
> 不想传的话删掉也不影响游戏运行。

---

## 2. 开启 GitHub Pages

1. 打开仓库页面 → 顶部 **Settings**（设置）；
2. 左侧栏找到 **Pages**；
3. **Build and deployment → Source** 选 **Deploy from a branch**；
4. **Branch** 选 `main`，目录选 `/ (root)`，点 **Save**；
5. 等 1～2 分钟，刷新页面，顶部会出现你的默认网址：

```
https://<你的用户名>.github.io/love-functions/
```

打开它，应该能直接玩。**先确认这一步没问题，再继续绑定域名。**

> 小提示：仓库改成私有（Private）后，免费版 Pages 会停止发布，网址会 404。

---

## 3. 绑定自己的域名

### 3.1 先在 GitHub 里填域名（顺序很重要）

1. 仓库 → **Settings → Pages**；
2. 找到 **Custom domain**，输入 `love.example.com`，点 **Save**；
3. 此时会提示 DNS 尚未配置，这是正常的，先去配 DNS（第 3.2 步）。

> 官方建议：**先**把域名添加到 GitHub，**再**去 DNS 服务商配置解析。反过来做，域名有被别人抢注（domain takeover）的风险。
> 另外可以在 Pages 页面点 **Verify domain**（验证域），按提示在 DNS 加一条 `_github-pages-challenge-<用户名>` 的 `TXT` 记录，验证后更安全。

### 3.2 在域名服务商配置 DNS

登录你买域名的网站（阿里云「云解析 DNS」、腾讯云「DNSPod」、Cloudflare 等），找到 **DNS 解析 / 解析记录**，按下面的表格添加。

#### 情况 A：用子域名 `love.example.com`（推荐）

| 记录类型 | 主机记录（名称） | 记录值 | TTL |
| --- | --- | --- | --- |
| `CNAME` | `love` | `<你的用户名>.github.io` | 默认（如 600） |

注意：

- 记录值**不要**带仓库名，**不要**写成 `<你的用户名>.github.io/love-functions`；
- 记录值**不要**带 `https://`；
- 不要指向 GitHub Pages 设置里那个 `*.pages.github.io` 的唯一子域名。

#### 情况 B：用根域名 `example.com`

根域名不能加 `CNAME`（DNS 规范不允许），要用 `A` 和 `AAAA` 记录：

| 记录类型 | 主机记录（名称） | 记录值 |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `AAAA` | `@` | `2606:50c0:8000::153` |
| `AAAA` | `@` | `2606:50c0:8001::153` |
| `AAAA` | `@` | `2606:50c0:8002::153` |
| `AAAA` | `@` | `2606:50c0:8003::153` |

（IPv6 的 `AAAA` 可选，但官方推荐加上。）

如果希望 `www.example.com` 也能打开：

| 记录类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| `CNAME` | `www` | `<你的用户名>.github.io` |

GitHub 会自动在根域名和 `www` 之间做 301 跳转。

> **Cloudflare 用户注意**：添加记录时先把云朵图标设为 **仅 DNS（灰色云朵）**。橙色云朵（代理）会挡住 GitHub 签发 HTTPS 证书，等证书签发、网站正常后再决定是否开启代理。
>
> **不要使用通配符记录**（如 `*.example.com`），有域名被接管的风险。

### 3.3 检查 DNS 是否生效

等待 1～10 分钟（最长 24 小时），然后在 PowerShell 里验证：

```powershell
# 子域名：应看到 CNAME 指向 <用户名>.github.io
Resolve-DnsName love.example.com -Type CNAME

# 根域名：应看到 4 条 A 记录
Resolve-DnsName example.com -Type A

# 根域名 IPv6
Resolve-DnsName example.com -Type AAAA

# 也可以直接看解析结果（Windows 没装 dig，Linux/macOS 用 dig love.example.com）
nslookup love.example.com 8.8.8.8
```

DNS 生效后，回到 **Settings → Pages**，Custom domain 下方应显示绿色的
`Domain's DNS record successfully configured`。点击 **Check again** 可以手动刷新。

### 3.4 等 HTTPS 证书，勾选强制 HTTPS

域名生效后，GitHub 会自动为你的域名申请 Let's Encrypt 证书（通常几分钟，最长 24 小时）。

- 证书签发后，Pages 设置里的 **Enforce HTTPS** 复选框会变得可勾选，勾上它；
- 勾选后所有 `http://` 请求都会自动跳转到 `https://`；
- 如果 `Enforce HTTPS` 一直是灰色不可选，说明证书还没签发完成，等一会儿再来；也可以把 Custom domain 删掉、重新保存一次触发重试。

验证：

```powershell
curl.exe -I https://love.example.com
# 期望看到 HTTP/2 200 或 301
```

🎉 到这里，`https://love.example.com` 就是你的游戏网站了。

---

## 4. 关于 `CNAME` 文件

从分支发布（本项目就是）时，GitHub 在保存自定义域名后会**自动**在仓库根目录创建一个 `CNAME` 文件，内容只有一行域名，例如：

```
love.example.com
```

要点：

- 文件里**只放域名**：不要 `https://`，不要路径，不要多余空格；
- 它必须放在**发布目录的根**（本项目是仓库根目录）；
- 如果设置里的 Custom domain 和 `CNAME` 文件里的域名不一致，Pages 会报错，改到一致即可；
- 仓库里的 `CNAME.example` 只是给你参考的模板，**不要**直接改成 `CNAME` 后填一个还没配置的域名，否则默认的 `github.io` 网址会跳转到不存在的域名。

如果你想手动加：在仓库根目录新建文件 `CNAME`，内容写你的域名，提交推送即可。
PowerShell 写法：

```powershell
Set-Content -Path CNAME -Value "love.example.com" -NoNewline -Encoding ascii
git add CNAME
git commit -m "chore: 绑定自定义域名"
git push
```

---

## 5. 以后怎么更新网站

改完代码之后：

```powershell
git add -A
git commit -m "update: 调整了 xxx"
git push
```

GitHub Pages 会在 1～2 分钟内自动重新部署（可以在仓库的 **Actions** 标签页看部署记录）。如果浏览器看到的还是旧版本，按 `Ctrl + F5` 强制刷新。

---

## 6. 上线检查清单

- [ ] 仓库是 Public，`main` 分支上有 `index.html`
- [ ] Settings → Pages 已开启，默认网址 `https://<用户名>.github.io/<仓库名>/` 能打开、能玩
- [ ] Custom domain 已填写，且与 `CNAME` 文件内容一致
- [ ] DNS 记录已按上表添加，`Resolve-DnsName` 能查到
- [ ] Pages 页面显示 DNS 配置成功
- [ ] `Enforce HTTPS` 已勾选，`https://你的域名` 能打开
- [ ] 手机浏览器也能正常玩（竖屏布局）
- [ ] 四关都能通过，通关后能保存 LOVE 图片

---

## 7. 常见问题

**Q：打开 `https://<用户名>.github.io/<仓库名>/` 是 404？**
检查 Settings → Pages 是否已开启、分支是否选了 `main`、目录是否是 `/ (root)`；刚开启时等 1～2 分钟。仓库是 Private 且免费计划时不会发布。

**Q：页面能打开但样式/脚本全丢，白底黑字？**
99% 是路径问题。本项目所有资源都用**相对路径**（`assets/style.css`），放在仓库根目录即可；如果你把文件挪到了子文件夹，请保持 `index.html` 与 `assets/` 的相对位置不变。

**Q：Custom domain 提示 “Domain is already taken”？**
这个域名被别的仓库占用过。去那个仓库的 Settings → Pages 把自定义域名删掉，再回来重试（也可能是你之前用别的 GitHub 账号绑定过）。

**Q：DNS 一直检查不通过？**
① 记录值别带仓库名和协议；② 子域名用 `CNAME`、根域名用 `A/AAAA`；③ 检查是否有冲突的旧记录（比如根域同时有别的 A 记录）；④ 等 TTL 过期（常见 10 分钟～24 小时）；⑤ 用 `nslookup 你的域名 8.8.8.8` 换个 DNS 服务器确认。

**Q：`Enforce HTTPS` 是灰色的 / 提示证书错误？**
GitHub 签发证书需要 DNS 已经正确指向它，且历史上有 `http://` 访问记录。等 10～60 分钟重试；Cloudflare 用户先把橙色云朵改成“仅 DNS”；还不行就把 Custom domain 删掉重新保存一次。

**Q：更新了代码，网站没变化？**
等 1～2 分钟部署完成；`Ctrl + F5` 强刷；检查 Actions 页最近一次部署是否成功；如果网站绑了 Cloudflare 代理，可能需要清一下 Cloudflare 缓存。

**Q：国内访问很慢或打不开？**
GitHub Pages 的服务器在境外，国内访问速度不稳定（尤其是晚高峰），这是网络问题，不是代码问题。可以先用手机流量/其他网络确认站点本身正常；需要国内访问更快，可以换 Cloudflare Pages、Vercel、Netlify 等静态托管（本仓库是纯静态、无构建，迁过去基本是拖拽上传即可）。

**Q：域名需要备案吗？**
网站放在 GitHub Pages（境外服务器）时不需要 ICP 备案；但如果以后迁到境内服务器就需要了。

**Q：仓库改名/换账号会怎样？**
默认网址会跟着变（`https://<用户名>.github.io/<新仓库名>/`），自定义域名不受影响。

---

## 8. 备选：托管到别处

这个项目是**纯静态、零构建**的，`index.html` 打开就能跑，所以也可以直接丢给：

- **Cloudflare Pages**：连 GitHub 仓库，构建命令留空，输出目录填 `/`；
- **Vercel / Netlify**：同上，选择 “Other / 静态站点”，输出目录 `/`；
- 自己的服务器：把整个文件夹丢进 Nginx 的 `html` 目录即可。

换托管后，自定义域名在对应平台的设置里绑定，DNS 按平台提示配置即可。

---

有问题欢迎提 Issue；喜欢的话给个 ⭐ 也行。
