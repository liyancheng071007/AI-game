# 交付包使用说明

## 推荐发送内容

运行：

```powershell
Set-Location E:\注意力高亮_板块B
pnpm package:handoff
```

脚本会在 `E:\` 生成：

- `注意力高亮_板块B_handoff_<时间>.zip`
- 对应的 `.zip.sha256` 校验文件

ZIP 包含源码、锁文件、文档、测试、12 句 draft 数据和真实模型质量报告，不包含：

- `node_modules`
- `.venv`
- `.tools`
- `.models`
- `.cache`
- 已编译的 `packages/*/dist`

不含环境和模型是因为这两部分体积大，而且可以通过固定版本的锁文件和脚本重新生成。

## 接收方步骤

1. 将 ZIP 解压到 `E:\`，最终目录必须是 `E:\注意力高亮_板块B`。
2. 如果同名目录已存在，先备份或改名，不要覆盖。
3. 接收方需要预先具备 Node.js 20+ 和 pnpm 9+。
4. 执行：

```powershell
Set-Location E:\注意力高亮_板块B
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
pnpm test
pnpm build
pnpm validate:levels
```

`setup.ps1` 会把 Python、pip、pnpm 和 npm 缓存固定在本项目内。

只查看或接入算法与 draft 数据时，不需要下载模型。需要重新运行离线管线时执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-pipeline.ps1
```

脚本会从 ModelScope 按 `models.lock` 中的精确 commit 下载两套模型到项目 `.models`。

## 校验 ZIP

发送方和接收方都可以执行：

```powershell
certutil -hashfile E:\注意力高亮_板块B_handoff_<时间>.zip SHA256
```

结果应与同名 `.sha256` 文件中的哈希一致。

## 什么时候需要带模型

仅在接收方无法联网、但需要重跑真实模型时，才考虑单独复制 `.models`。该目录约 824MB，不建议随普通源码包发送。若确需离线交付，应使用加密移动盘或企业文件传输，并单独核对 `pipeline/models.lock` 中的权重哈希。
