# dsh-opening-animation

[English](README.en.md)

DeepSeek Harness Web 的开场动画插件：每次 dsh web 页面加载时，在全屏遮罩上播放你选择的开场内容——图片动画或视频——结束后以可配置的过渡效果把画面交还主界面。形态与 [dsh-custom-skin](https://github.com/SLin-code/dsh-custom-skin) 完全同构，可与其同场运行。

## 功能

- **图片开场**（jpg/png/webp/gif/avif，≤20 MB，导入时实测解码并拒绝超过 3200 万像素（约 8K 幅面）的图片，库上限 8 条；容量截断与解码失败都会明确提示，不会静默丢弃）
- **图片开场播放顺序**（单一 / 顺序 / 随机，默认单一）：决定每次启动播放哪一张图片动画——顺序从选中的动画开始，之后每次启动按播放列表顺序推进到下一个，到末尾回到开头循环；随机在多于一个时不会与上次重复；预览始终播放当前选中的媒体，视频不受此项影响
- **视频开场**（mp4/webm/mkv，≤256 MB，导入时探测解码支持）：静音自动播放（启动自动播放始终静音，这是浏览器自动播放政策；预览在用户手势下按音量设置出声），播完收场，长视频不截断；填充方式（铺满 cover / 完整显示 contain，默认 cover）与缩放、水平/垂直偏移可调（缩放默认 1 不缩放，水平/垂直偏移默认 0 居中，单位为屏幕宽/高的百分比）；视频结尾音频按指数曲线淡出（先快后慢），淡出时长可调（默认 1.5 秒，0 为禁用）
- **收场过渡**：cross-fade（默认）/ dip-to-bg / zoom-fade，速度可调（0.5–2×）；动画期间主界面被遮罩按住（`#root` 由 pending 属性压住不闪帧），过渡结束后还原
- **随时跳过**：点击任意处或 Esc（右下角跳过提示可关；tap-reveal 的第一击固定用于开始揭示，此后规则与其他动画一致）
- **设置页**（个性化 › 开场动画）：顶部 Language 项切换整个 DSH Web 的界面语言；上传/选择/删除/清空媒体（库满或批量导入被上限截断时明确提示，高级参数的文本输入框与数字/下拉控件共用同一套主题令牌，安装 dsh-custom-skin 时随壁纸风格自动融合）、切换动画与过渡、调整高级参数、预览、恢复默认行为；启动播放默认关闭，需在设置中开启
- **保险与 fail-open**：主界面永远可用。引擎致命错误（存储打不开、媒体缺失、图片加载失败等）立即无过渡撤除遮罩；三道看门狗——加载超时 8s（引擎上报媒体就绪后即解除）、图片超过时长上限（默认 15s、可调 3–120s：仅是强制收场保险，不决定播放时长，实际时长由动画自身参数决定；视频不受限）、视频无进度 10s（覆盖播放中途缓冲掉级的情形，不只看数据就绪状态）——触发时带过渡收场；浏览器存储配额已满时写入失败单独提示。预览不受「每次页面加载只播一次」限制，且忽略系统 reduced-motion（启动自动播放仍尊重）
- **无障碍**：播放期间主界面进入 inert 状态（键盘焦点不会落入被遮住的控件），装饰画布对屏幕阅读器隐藏（跳过提示文字保留可读），遮罩撤除后恢复原焦点
- **与 dsh-custom-skin 联动**（默认关闭）：开启后上传的图片可同步复制进壁纸库，单向、不改皮肤偏好

### 图片开场动画

**tap-reveal**

![tap-reveal](docs/pic/3.gif)

**wipe-reveal**

![wipe-reveal](docs/pic/4.gif)

**pool**

![pool](docs/pic/Pool.gif)

**grid-reveal-spread**

![grid-reveal-spread](docs/pic/2.gif)

**retro-boot**

![retro-boot](docs/pic/retro-boot.gif)

**code-rain**

![coderain](docs/pic/CodeRain.gif)

独立可视化原型（单文件、内嵌素材、支持 `?t=<秒>` 冻结单帧）：[docs/retro-boot.html](docs/retro-boot.html)

### 视频开场动画

![视频开场动画](docs/pic/5.gif)

## 构建

需要 Node ^22.19.0 或 ≥24：

```sh
pnpm install
pnpm check   # typecheck + vitest + build
```

CI（[.github/workflows/ci.yml](.github/workflows/ci.yml)）在 Node 22.19 / 24 矩阵上运行 `pnpm check` 与打包校验。测试为 jsdom 级单元/行为测试（92 项：控制器、看门狗、各动画引擎、偏好解析等）；Canvas 渲染、媒体解码与真实播放链路需在真实浏览器中人工验证——在加载本插件的 dsh web 实例设置页点「预览开场」是推荐的手工回归路径。

## 安装到 dsh web profile

```sh
cd $DSH_HOME/profiles/web
pnpm add <本目录路径或 tarball>
# 然后在 profile package.json 的 dsh.profile.bundles 数组中加入 "dsh-opening-animation"
```

## 加一个新动画

新动画 = 一个引擎文件 + `registry.ts` 里一行注册；参数经 `paramsSchema` 声明后设置页自动渲染，播放链路零改动（ADR-003）。

## License

MIT
