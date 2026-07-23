# Claude Starter 自托管维护指南

## Cheat Sheet

每次改完代码并准备使用新版本时，在仓库根目录重新运行：

```bash
npm run test:all && npm install -g . --install-links
```

测试通过后，npm 会把当前源码复制为一份固定副本：

- 包目录：`/Users/rejectliu/.local/lib/node_modules/claude-starter`
- 命令入口：`/Users/rejectliu/.local/bin/claude-starter`

之后继续修改仓库不会影响这份副本；下次要更新日常使用的版本，再运行同一条命令即可。

## 为什么默认使用固定副本

本指南默认使用：

```bash
npm install -g . --install-links
```

在当前 npm 中，直接对本地目录执行 `npm install -g .` 可能创建指向工作区的链接；`--install-links` 会先打包再复制，确保全局命令使用稳定快照。

固定副本有这些特性：

- 只有测试并重新安装后，修改才会影响日常命令。
- 切换分支、产生未提交修改时，不会意外改变正在使用的版本。
- 移动或删除源码目录后，已经安装的命令仍可运行。
- 每次合并或同步代码后都需要重新安装。

## 首次配置或迁移

这里的 self-host 是指：源码由自己的 GitHub fork 和本地仓库维护；测试通过后，使用 npm 将当时的源码复制到全局安装目录。需要 Node.js 18 或更高版本、npm 和 Git。

远端应当是 `origin` 指向自己的 fork，`upstream` 指向原作者仓库。缺少 `upstream` 时执行：

```bash
git remote add upstream https://github.com/Bojun-Vvibe/claude-starter.git
```

首次安装或从 `npm link` 切回固定副本：

```bash
npm ci
npm run test:all
npm install -g . --install-links
```

该安装命令会直接替换同名的 npm 全局副本或 npm 链接，不需要预先卸载。如果 `command -v claude-starter` 指向 `~/.bun/bin`，先在仓库根目录执行 `bun unlink`，再运行上面的安装命令。

## 日常维护

### 同步原作者仓库

自己的 `main` 已包含 fork 独有提交。原作者将来更新后，两条历史会分叉，因此 `git merge --ff-only upstream/main` 会失败。使用普通 merge，并在测试通过后再推送：

```bash
git switch main
git pull --ff-only origin main
git status --short
git fetch upstream --tags --prune
git merge upstream/main

# 如有冲突，解决并完成 merge 后再继续
npm ci
npm run test:all
git push origin main
npm install -g . --install-links
hash -r
```

### 开发自己的功能

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/my-change

# 修改并验证
npm run test:all
git add .
git commit -m "feat: describe my change"
git push -u origin feat/my-change
```

通过 PR 合并到自己的 `main` 后，再从 `main` 执行 Cheat Sheet 中的安装流程。

## 可选：npm link 开发模式

如果希望源码修改立即反映到全局命令，可以在仓库根目录执行：

```bash
npm ci
npm link
hash -r
```

验证时，`realpath "$(command -v claude-starter)"` 应指向当前仓库的 `index.js`。链接模式适合短期开发，但切换分支或写入未完成代码也会立即影响命令。

开发结束后恢复固定副本：

```bash
npm run test:all
npm install -g . --install-links
hash -r
```

## 不要使用程序自带的 `--update`

`claude-starter --update` 安装的是 npm registry 中原作者发布的版本：

```bash
npm install -g claude-starter@latest
```

它不会安装自己 fork 中的修改。self-host 模式应通过 Git 更新源码，再运行测试和本地固定副本安装命令。

## GitHub Actions 与 npm 发布

本地 self-host 不需要 npm 包的发布权限。仓库工作流会在 `v*` tag 上尝试发布名为 `claude-starter` 的官方同名包；没有该 npm 包权限时不要创建发布 tag。若以后需要公开发布 fork，应先改为自己拥有的包名或 npm scope，并同步修改更新逻辑。

## 恢复官方 npm 版本

```bash
npm install -g claude-starter@latest
hash -r
claude-starter --version
```

## 常见问题

### 为什么修改源码后命令没有变化？

这是固定副本模式的预期行为：

```bash
npm run test:all
npm install -g . --install-links
hash -r
```

### 为什么 `--version` 相同，代码却可能不同？

fork 的提交不一定同步修改 `package.json` 版本号，因此 `--version` 不能证明已安装最新源码。使用：

```bash
cmp -s index.js "$(realpath "$(command -v claude-starter)")" && echo "source matches"
```

### npm 全局安装报 `EACCES`

通常是以前通过 `sudo npm install -g` 留下了 root 所有权文件。只清理这个包，并把 npm prefix 配置到当前用户可写目录；不要递归修改整个系统目录的权限。
