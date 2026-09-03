# 词组口袋

适合 iPhone 16 Pro 的离线词组复习 PWA。内置 115 条经校对的词组，每条附有原创英文例句及中文翻译；支持添加词组、随机抽取、点击查看中文与例句，以及“又忘了”“记住了”保存后立即换词。无需登录，无后端、数据库或第三方运行资源。

使用地址：https://yhcfeel.github.io/phrase-pocket/

词组标题保持单行，根据实际宽度在 22–36 px 内调整字号；极长的自定义词组可以横向查看。深绿衬线字体用于词组，蓝色用于英文例句，暖棕色用于中文翻译，例句中的目标表达会突出显示。

## 在 iPhone 上使用

1. 用 Safari 打开部署完成后的 GitHub Pages 地址。
2. 保持联网，等底部显示“离线已就绪”。
3. Safari 分享 → 添加到主屏幕；若出现“作为 Web App 打开”，保持开启。
4. 从主屏幕图标打开一次，确认同样显示“离线已就绪”，再开启飞行模式检查。
5. 右上角 ＋ 可以添加英语词组和中文释义，断网时也能添加和复习。

添加窗口中的“添加例句与翻译（选填）”可展开填写自己的双语例句；填写时两项需要一起提供。不填写也可以保存词组。已有个人词组继续保留，没有例句的旧条目不会被替换成自动猜测的句子。

首次加载必须能连接 GitHub Pages；无法保证每个中国大陆网络都能稳定访问它。完整缓存后，日常使用不需要联网。

## 更新与数据

- 每次启动、恢复前台或重新联网时检查更新。完整新版下载后显示“新版已备好”和“更新”。点击后切换，保留本机添加的词组与复习权重。
- 新版未下载完整时继续使用旧版。添加窗口尚未关闭时不会因另一窗口更新而丢掉输入。
- 更新资源缓存不会删除学习数据。内置词库使用稳定 ID：纠正旧词时保留原 ID，新增时使用新的 p 编号。
- 本地数据属于当前设备和网站地址，不会上传 GitHub，也不会在电脑与手机间同步。旧 chatgpt.site 网站、Scriptable 与这个新地址的数据不会自动互通。
- 离线不等于永久保存：清除 Safari 网站数据、设备存储回收或移除相关数据可能使词组/缓存丢失。应用会尝试请求持久存储，但是否批准由 iOS 决定。请勿用无痕浏览保存长期进度。

## 电脑端更新：不需要安装开发环境

在 GitHub 仓库编辑 `app/phrases.json` 或其他应用文件，保存提交到 `main` 即可。GitHub Actions 自动构建、测试并发布；在 Actions 中确认发布成功，再用手机联网打开。

新词格式示例（追加到数组内，注意逗号和不重复的编号）：

```json
{"id":"p116","page":6,"english":"keep in mind","chinese":"记住；牢记","source":"https://dictionary.cambridge.org/dictionary/english/keep-in-mind","note":"校对说明","example":{"english":"Keep in mind that the shop closes early.","chinese":"请记住，这家店关门很早。","highlights":["Keep in mind"]}}
```

`source` 和 `note` 用于校对记录，不会在复习卡上增加内容。`example.highlights` 按句子顺序列出要突出显示的原文片段，大小写必须与句子一致，也可省略。例句为原创学习场景，展示对应词条的一种常见用法，并非穷尽全部词义或声称引用自词典。修改词库前核对可靠词典，避免机械照抄笔记。

## 发布设置

- 使用公开 GitHub 仓库及 GitHub Pages 免费地址，不购买域名。
- 仓库 Settings → Pages → Source 使用 GitHub Actions。
- `.github/workflows/pages.yml` 在 `main` 提交时触发。构建不安装 npm 依赖，使用 GitHub 提供的 Node.js。
- 发布目录为 `dist/client`，只包含静态公开文件；不上传学习数据、凭证或旧 Sites 配置。
- 所有运行路径、manifest 的 id/start_url/scope、图标与 Service Worker 都相对于项目目录，兼容 `https://用户名.github.io/仓库名/`。
- 构建从 Pages 元数据取得真实网址用于分享图片，不硬编码域名。

## 开发与验证（可选）

已有 Node.js 22 或更新版本的环境可运行：

```text
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/serve.mjs dist/client 4173
```

测试覆盖断网获取完整资源、词库正确合并、保存与概率、子路径、完整性校验和更新切换；模拟浏览器接口运行，不能代替真实 iPhone Safari 测试。

技术依据：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Service Worker 更新](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update)、[浏览器存储保留条件](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)。
