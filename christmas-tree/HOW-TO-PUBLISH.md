# 把项目开源到 GitHub · 手把手指南

这份指南为零基础准备，跟着做即可。全程在 **项目文件夹** 里操作。

> 开始前需要：一个 GitHub 账号 + 安装 [Git](https://git-scm.com/download/win)。  
> 你的 GitHub 用户名：`marker404`，仓库名：`christmas-tree`，隐私邮箱：`239368236+marker404@users.noreply.github.com`（以下均已填好，直接复制即可）。

---

## 第 0 步：上传前的隐私检查（重要）

本项目已替你做好以下处理，上传前请知悉：

- ✅ 测试录像 `1.mp4` / `2.mp4` 已在 `.gitignore` 中排除，**不会上传**。
- ✅ 根目录个人照片已排除，**不会上传**。
- ✅ 题字默认值设为「Doki」。
- ✅ `LICENSE` 署名已填为 `marker404`。
- ⚠️ **本机 Git 邮箱目前还是你的 QQ 邮箱**。由于你已开启 GitHub 的「阻止暴露邮箱的命令行推送」，用 QQ 邮箱提交后 `git push` 会被拒绝。所以**务必先做第 2 步换邮箱**。

---

## 第 1 步：在 GitHub 上创建空仓库

1. 打开 <https://github.com/new>，登录。
2. **Repository name** 填：`christmas-tree`
3. Description 可填：`用 Three.js 与摄像头手势控制的 3D 粒子圣诞树`
4. 选择 **Public**（公开）。
5. **不要勾选** "Add a README file"、".gitignore"、"license" —— 我们本地都已经有了，勾了会冲突。
6. 点 **Create repository**。
7. 创建后页面会显示一段命令，先不用管，回到本地。

---

## 第 2 步：初始化本地 Git 并配置隐私邮箱（必做）

在项目文件夹空白处按住 `Shift` + 右键 → 「在此处打开 PowerShell 窗口」（或打开终端后 `cd` 到项目目录），依次执行：

```bash
# 初始化仓库
git init

# 换成 GitHub 隐私邮箱（你截图里显示的那串）
git config user.name "marker404"
git config user.email "239368236+marker404@users.noreply.github.com"

# 查看确认（应显示隐私邮箱）
git config user.name
git config user.email
```

> 💡 这两条 `git config` 不带 `--global`，只对当前仓库生效，不影响你其它项目。隐私邮箱来自你截图里 "Keep my email addresses private" 下方那串地址。



---

## 第 3 步：暂存并提交

```bash
# 查看将要提交的文件，确认没有 mp4 / 个人照片
git status

# 暂存全部（.gitignore 已自动排除隐私文件）
git add .

# 再次确认暂存列表里没有录像和照片
git status

# 提交（这里用的就是刚才配的隐私邮箱）
git commit -m "Initial commit: gesture-controlled粒子圣诞树"
```

> 如果 `git status` 里出现了 `1.mp4` / `2.mp4` 或照片，说明 `.gitignore` 没生效，先别提交，回看 `.gitignore` 是否在项目根目录。

---

## 第 4 步：关联远程仓库并推送

```bash
# 关联 GitHub 仓库
git remote add origin https://github.com/marker404/christmas-tree.git

# 把主分支命名为 main（GitHub 默认）
git branch -M main

# 推送
git push -u origin main
```

首次推送会弹出 GitHub 登录窗口，按提示登录授权即可（或用 Personal Access Token，见下方 FAQ）。

刷新你的仓库页面，代码就上去了。

---

## 第 5 步：上传后建议做的几件事

1. **补一张封面图**：README 顶部目前没有截图。截一张树的运行效果图，在 GitHub 仓库点 "Add file" → 上传成 `preview.png`，然后在 README 顶部插入 `![预览](preview.png)`。
2. **设置仓库主页信息**：仓库页面右侧 "About" 里填上描述、关键词、网站链接。
3. **验证克隆可用**：找另一台机器 `git clone` 下来，跑 `node server.js`，确认离线也能打开。

---

## 常见问题

**Q：`git push` 报错 `remote: Repository not found`？**  
A：检查远程仓库地址用户名 / 仓库名是否拼对；用 `git remote -v` 查看当前地址，错了用 `git remote set-url origin <正确地址>` 改。

**Q：推送被拒绝，提示暴露了邮箱 / `denied ... email address`？**  
A：说明某次 commit 用的是 QQ 邮箱。确认第 2 步的 `git config user.email` 已设成隐私邮箱；若之前已用错邮箱 commit，执行 `git commit --amend --reset-author --no-edit` 重写作者信息后再 push。

**Q：推送要求输入密码，但 GitHub 已不支持账号密码？**  
A：需要用 Personal Access Token（PAT）代替密码：<https://github.com/settings/tokens> 生成一个勾选 `repo` 权限的 token，弹出密码框时粘贴它（用户名填 `marker404`）。

**Q：我不小心把隐私文件提交了怎么办？**  
A：在还没 push 时执行 `git rm --cached 文件名` 把它从暂存移除再 commit；如果已经 push，需要从仓库删除并考虑用 `git filter-repo` 清理历史（较复杂，尽量避免）。

**Q：以后改了代码怎么更新？**  
A：三步走：`git add .` → `git commit -m "说明"` → `git push`。

---

## 命令速查

```bash
git status                      # 看改了什么
git add .                       # 暂存全部改动
git commit -m "说明"            # 提交
git push                        # 推送到 GitHub
git pull                        # 拉取远端更新
```
