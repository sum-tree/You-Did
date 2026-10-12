# 开发约定

- 所有验证命令在项目根运行：`npm.cmd test`、`npm.cmd run build`（非 Windows 使用 `npm`）。修改奖励、日期、每日分配或持久化逻辑时须运行两项；纯文档可跳过。
- 奖励以不可变的完成记录和奖励流水为准；清空、编辑或跨周迁移任务不得回退奖励。课程任务不叠加第二份普通任务奖励。
- 本机 E: 文件系统不记录所有者。若 Git 报 dubious ownership，仅对本仓库执行 `git -c safe.directory="E:/Github/You Did - Motivational Productivity App" ...`，不添加全局通配信任。
- 若本机全局 npm 缓存损坏，使用 `npm.cmd ci --cache .npm-cache`，不要清除用户的全局缓存。
- 项目日期按浏览器本地日历计算，周一开始；不要用 UTC 截取日期，以免在午夜附近计入错误的一天。
- 本机创建前为空目录，没有源码或验证命令可运行，首次创建无测试基线。未来改动遵守先验证基线再编辑。
