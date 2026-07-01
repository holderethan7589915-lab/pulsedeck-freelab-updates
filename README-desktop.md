# PulseDeck Freelab Desktop

## 开发启动

1. 安装依赖：`npm install`
2. 启动桌面版：`npm run dev`

## 打包

1. 安装依赖：`npm install`
2. 生成便携版 EXE：`npm run dist`
3. 成品默认输出到 `dist/`

## 说明

- 桌面版直接加载当前目录下的 `index.html`
- 串口授权和串口选择由 Electron 主进程接管
- 当前配置默认生成 Windows x64 的便携版，可双击运行
- 项目已写入国内镜像配置，重新执行 `npm install` 和 `npm run dist` 时会优先走镜像
- 当前为了避免外部签名工具下载失败，打包时关闭了 EXE 资源编辑，生成包会使用默认 Electron 图标
