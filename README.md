# 汪昊阳 · Personal Portfolio

个人作品集：AI 应用、视觉设计、摄影与生活。React、Three.js 和 Vite 构建。

网站：https://haoyangwang168-hue.github.io/

## 本地开发

需要 Node.js 24 和 pnpm 11.25.0。

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

## 更新网站

修改 web/src 或 web/public 中的内容，检查通过后提交并推送到 main。
GitHub Actions 将自动运行 lint、测试、类型检查与构建，再发布到 GitHub Pages。
仅在本地保存文件不会更新线上网站；部署成功后，网站链接保持不变。

```sh
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

在仓库 Actions 页面查看发布状态。发布失败时先修复错误，再推送新提交。
如需撤回更新，可还原相应提交并再次推送，自动部署恢复后的版本。

后续可在 Settings → Pages → Custom domain 中绑定自有域名，按 GitHub 文档配置 DNS 与 HTTPS。

## 来源与许可

网站代码基于 [dayinji/sen-3d-resume](https://github.com/dayinji/sen-3d-resume)，保留原 MIT LICENSE 和 NOTICE。
当前个人文案、作品照片与人物素材已替换为汪昊阳的作品集内容；个人素材不因代码许可而自动获得再分发授权。
字体及其他素材许可证随文件保留。
