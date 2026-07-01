# PulseDeck Freelab 上位机

这是一个基于 Electron 的 Windows 上位机程序，用于串口连接、协议解析、原始数据查看、关键参数可视化和软件自动更新。

## 主要功能

- 串口连接、接收、发送、日志查看
- MK8000 48 字节 UART 帧解析
- 原始 HEX 帧显示
- 字段映射表和字段历史记录
- 距离、角度、摇杆、按键、IMU 等关键数据可视化
- GitHub Releases 自动更新

## 本地运行

先确认电脑已经安装 Node.js。

```powershell
cd D:\E\上位机
npm install
npm run dev
```

## 打包成安装程序

```powershell
cd D:\E\上位机
npm run dist
```

打包完成后，安装包会生成在 `dist` 目录里，常见文件是：

```text
PulseDeck-Freelab-Setup-版本号.exe
PulseDeck-Freelab-Setup-版本号.exe.blockmap
latest.yml
```

别人第一次使用时，只需要下载安装 `PulseDeck-Freelab-Setup-版本号.exe`。

## 发布更新

自动更新仓库：

```text
https://github.com/holderethan7589915-lab/pulsedeck-freelab-updates
```

发布新版本时按这个流程：

1. 修改 `package.json` 里的版本号，例如从 `0.1.0` 改成 `0.1.1`。
2. 运行 `npm run dist` 重新打包。
3. 打开 GitHub 仓库的 `Releases` 页面。
4. 新建 release，tag 写成 `v版本号`，例如 `v0.1.1`。
5. 上传 `dist` 里的 `.exe`、`.blockmap`、`latest.yml`。
6. 点击 `Publish release`。

用户打开已安装的软件后，会自动检查 GitHub Releases 上的新版本。

## 注意事项

- 自动更新必须使用安装版，也就是 `npm run dist` 生成的 `Setup.exe`。
- `node_modules`、`dist`、缓存目录不会上传到 GitHub，这些文件可以重新生成。
- 如果 Windows 提示“未知发布者”，通常是因为没有代码签名证书，属于正常现象。
- 打包时建议关闭正在运行的旧版本软件，否则可能占用 `dist` 里的文件。
