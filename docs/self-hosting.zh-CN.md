# Claude Starter 自托管维护指南

本文适合已经通过 npm 安装 `claude-starter`，希望改为从自己的 Git fork 持续维护和运行源码版本的用户。

这里的“自托管”是指：源码保存在你自己的 fork 和本地 Git 工作区中，全局的 `claude-starter` 命令通过 npm 链接到本地源码。你不需要拥有官方 npm 包的发布权限。

## Cheat Sheet：从全局版切换到 self-host

在本地仓库目录中执行：

```bash
# 1. 把自己的 main 同步到上游最新版
git switch main
git fetch upstream --tags --prune
git merge --ff-only upstream/main
git push origin main

# 2. 安装依赖并确认源码可用
npm ci
npm run test:all

# 3. 移除之前通过 sudo 安装的官方全局版
sudo npm uninstall -g claude-starter

# 4. 让全局命令链接到当前源码目录
npm link

# 5. 验证
claude-starter --version
command -v claude-starter
npm list -g claude-starter --depth=0
```

以后同步更新只需要：

```bash
git switch main
git fetch upstream --tags --prune
git merge --ff-only upstream/main
git push origin main
npm ci
npm run test:all
```

全局命令已经链接到源码目录，因此无需再次执行 `npm link`。self-host 模式不要运行 `claude-starter --update`，它会重新安装 npm 上的官方版本并替换本地链接。

## 先理解三个独立位置

| 操作 | 更新的位置 | 不会更新的位置 |
|---|---|---|
| `npm install -g claude-starter` | npm 全局安装目录中的副本 | 本地 Git 仓库 |
| `git fetch` + `git merge` | 本地 Git 仓库 | npm 全局安装目录中的普通副本 |
| `npm link` | 让全局命令链接到当前源码目录 | 不会替你同步 Git |

因此，即使 GitHub 上已经发布了新版本，执行 `npm install -g claude-starter` 也不会改变本地仓库里的 `package.json`；反过来，仅同步 Git 仓库也不会更新一个没有链接的全局安装副本。

## 前置条件

- Node.js 18 或更高版本
- Git
- 一个 GitHub fork
- `origin` 指向你的 fork，`upstream` 指向原作者仓库

在项目目录中确认远端：

```bash
git remote -v
```

如果还没有配置 `upstream`：

```bash
git remote add upstream https://github.com/Bojun-Vvibe/claude-starter.git
```

## 一次性迁移到 self-host

### 1. 同步上游代码

先确保 `main` 没有未提交的修改：

```bash
git switch main
git status
git fetch upstream --tags --prune
git merge --ff-only upstream/main
git push origin main
```

`--ff-only` 会在主分支已经产生分叉时停止，而不是自动制造一个意外的合并提交。

### 2. 安装依赖并运行测试

```bash
npm ci
npm run test:all
```

只有测试通过后再切换全局命令，可以避免把无法启动的工作区直接暴露为日常命令。

### 3. 移除原来的全局副本

先查看 npm 的全局安装位置：

```bash
npm config get prefix
npm list -g claude-starter --depth=0
```

如果原来没有使用 `sudo` 安装：

```bash
npm uninstall -g claude-starter
```

如果原来使用了 `sudo npm install -g claude-starter`，只在这次清理时对应使用：

```bash
sudo npm uninstall -g claude-starter
```

清理完成后不要再用 `sudo` 安装 npm 全局包。建议把 npm prefix 配置在当前用户可写的目录中。

### 4. 将全局命令链接到本地源码

在仓库根目录执行：

```bash
npm link
```

验证结果：

```bash
claude-starter --version
command -v claude-starter
npm list -g claude-starter --depth=0
```

`npm list -g` 通常会显示一个指向当前项目目录的链接。此后修改 `index.js` 会直接影响 `claude-starter` 命令，不需要重复全局安装。

如果 zsh 仍缓存旧的命令位置，可以执行：

```bash
rehash
```

## 日常维护流程

### 同步原作者的新版本

```bash
git switch main
git status
git fetch upstream --tags --prune
git merge --ff-only upstream/main
git push origin main
npm ci
npm run test:all
```

因为全局命令已经链接到这个工作区，代码同步完成后不需要再次运行 `npm link`。

### 开发自己的功能

不要直接在 `main` 上开发。为每项改动创建分支：

```bash
git switch main
git switch -c feat/my-change

# 修改并验证代码
npm run test:all

git add .
git commit -m "feat: describe my change"
git push -u origin feat/my-change
```

这样可以继续安全地同步 `upstream/main`，也方便向上游提交 Pull Request。

## self-host 模式下不要使用 `--update`

当前的 `claude-starter --update` 会执行：

```bash
npm install -g claude-starter@latest
```

这会用 npm 上的官方版本替换本地链接。self-host 模式应使用 Git 同步流程更新，不要运行：

```bash
claude-starter --update
```

如果误操作导致链接被替换，回到仓库根目录重新执行：

```bash
npm ci
npm link
```

## 链接模式和固定副本模式

开发维护时推荐 `npm link`：

```bash
npm link
```

它会让源码修改立即生效。如果更希望全局命令使用一份稳定副本，可以改用：

```bash
npm install -g .
```

固定副本不会跟随工作区修改；每次更新源码并通过测试后，都需要再次执行 `npm install -g .`。

## 恢复使用官方 npm 版本

在仓库根目录取消链接并安装官方最新版：

```bash
npm unlink -g claude-starter
npm install -g claude-starter@latest
rehash
claude-starter --version
```

这不会删除你的 Git 仓库和个人分支，之后仍然可以重新运行 `npm link` 切回 self-host。

## 常见问题

### GitHub 已经发布新版本，本地为什么还是旧版本？

分别检查 Git 源码和全局命令：

```bash
git describe --tags --always
node -p "require('./package.json').version"
claude-starter --version
npm view claude-starter version
```

这四项分别表示当前 Git 提交、源码版本、正在执行的全局命令版本和 npm registry 最新版本，它们在没有同步或链接时可以不同。

### `npm link` 报 `EACCES`

通常是之前使用 `sudo npm install -g` 留下了 root 所有权文件。先用对应的 `sudo npm uninstall -g claude-starter` 只清理这个包，再以普通用户运行 `npm link`。不要对整个系统 npm 目录执行递归改权限。

### 移动项目目录后命令无法运行

全局链接仍指向旧路径。进入新目录重新执行：

```bash
npm ci
npm link
rehash
```
