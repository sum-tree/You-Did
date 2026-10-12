# You Did! — Motivational Productivity App

每一个小小的完成，都值得被看见。手机端优先的求职与学习效率应用：每日任务、成就、待办、日历，以及即时卡拉米奖励。

## 在 Windows 本机启动

需要 Node.js 24 或更高版本。打开 PowerShell：

```powershell
Set-Location -LiteralPath 'E:\Github\You Did - Motivational Productivity App'
npm.cmd ci --cache .npm-cache
npm.cmd run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173/`。使用 `npm.cmd` 可避免 PowerShell 对 `npm.ps1` 的执行策略限制。依赖版本固定在 `package-lock.json`，换机器使用 `npm ci`，不要删除锁文件。

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`build` 先进行 TypeScript 检查，再生成 `dist/`；`preview` 默认使用5173以外的端口，适合检查生产构建。项目使用 Vite + React + TypeScript，无后端、账号或数据库。图标来自 lucide-react；植物插画使用本地 CSS，无外部字体或图片请求。

## 如何使用

1. 在「待办」添加本周任务，选择类型、优先级、截止日期、目标贡献和数量。
2. 「每日」默认自动选择2项，到期任务优先，最多3项。手动安排后以所选任务为准；所有到期/逾期事项仍会在独立提醒区显示。
3. 完成任务获得5卡拉米，目标贡献计入实际完成的那一周。「成就」展示目标进度、特别挑战和奖励明细。
4. 在「日历」单独添加重要日期与提醒；日历事项不会自动生成任务、进度或积分。
5. 没做完的任务可以移到下周或清空。清空是可恢复的归档，不扣积分；已完成任务不能再次领取奖励。

课程初始为第6/15周，可在设置中手动调整。每个粤语贡献单位代表一整次30分钟练习。目标以周一至周日计算。

## 数据与跨设备迁移

数据保存在浏览器 `localStorage`，初始任务和积分为空。应用不是云同步服务：不同浏览器、域名、主机名或端口的记录分别保存。例如 `localhost:5173`、`127.0.0.1:5173` 和正式部署网址属于不同存储空间。

换设备或部署网址之前，在右上角「设置与数据备份」导出 JSON；在新环境导入。导入会先验证格式，再要求确认替换现有记录，建议先导出当前备份。请勿把个人任务备份提交到公开仓库。清理浏览器数据也会清除应用记录；定期导出备份。

损坏或不兼容的存储不会被初始化逻辑自动覆盖；应用会显示错误，并允许导出原始记录。浏览器存储失败时当前页面仍保留改动，请立即导出。若有多个标签页，同时编辑可能互相覆盖，建议只在一个标签页中修改；其他标签页会收到存储变更更新。

## 静态部署

运行 `npm.cmd run build` 后，把 `dist/` 目录部署到支持静态文件的服务即可。推荐配置：构建命令 `npm run build`、输出目录 `dist`、Node.js版本24。

- GitHub Pages：使用仓库提供的 `.github/workflows/deploy.yml`。在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**，然后从 Actions 手动运行 **Deploy GitHub Pages**。该流程只由手动操作触发，不会在本次创建时上传或部署。
- 其他静态托管：上传 `dist` 或设置上述构建命令与输出目录。

Vite 配置使用相对资源路径，兼容 GitHub Pages 的仓库子路径。四个页面在应用内切换，没有需要服务器重写的深层路由。部署到手机可访问的网址后直接在手机浏览器使用；本地开发服务默认只监听本机，不向局域网公开。

## GitHub 仓库

源码、锁文件、产品文档和工作流均可提交。`node_modules/`、`dist/`、npm缓存和运行日志被忽略。项目当前分支为 Git 默认初始化的 `master`，无需为继续开发切换分支。尚未关联远程仓库，也没有自动 push。

如果 E: 盘出现 `dubious ownership`，可仅对这次命令加精确目录参数：

```powershell
git -c safe.directory="E:/Github/You Did - Motivational Productivity App" status
```

产品规则见 [PRD v0.2](docs/PRD.md)，交互规格见 [移动端设计](docs/UI-Wireframe.md)，开发状态见 [交接记录](docs/STATUS.md)。

## 已知边界

- 提醒只在应用内呈现，尚不支持后台推送、系统通知或云同步。
- 每周目标奖励自动发放，进度降低不会收回已发奖励。同一任务、同一周目标与同一挑战档位只奖励一次。
- 完成记录不可撤销，以避免重复领取；清空未完成任务可从「已清空」恢复。
- 学期周数手动维护，不假定开学日期。课程周数进度和任务完成数量是两个独立指标。
- 未采用 Habitica / Super Productivity 的源码或素材；只参考其任务与正向反馈的设计思路。
