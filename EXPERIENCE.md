# 经验总结（WB Studio Tour Tokyo 票务抓取）

## 流程（最终版：按 ng-style 强制点击）
- 打开票务页：`https://www.wbstudiotour.jp/en/tickets/`
- 进入 Standard Tickets 的“BUY TICKETS”
- 在购票页增加 ADULT 数量后点击 “Continue To Calendar”
- 日历页：定位所有 `ng-style="{ 'background-color': day.priceProgramColor }"` 的元素
- 对每个元素，找到最近的 `role=button` 父节点（带 `aria-label` 的日期）
- 无论是否禁用，**强制点击**该日期并执行 `test.js` 抓取
- 结果导出 JSON

## 成功经验
- 必须在**浏览器上下文**执行 `test.js`，才能访问 `angular` 作用域
- `ng-style` 能准确定位“目标日期集”，覆盖禁用态（如 2/10）
- `ng-style` 元素自身不含日期信息，需通过 `closest('[role=button]')` 获取日期
- 先点击第一个 `ng-style` 元素，再跑 `test.js`，可触发组件初始化
- 抓取结果统一保存 JSON，便于比对与复用

## 失败/踩坑
- 在 Node 中运行 `test.js` 会报 `angular is not defined`
- 日历并非原生 `button`，仅遍历 `button` 会漏日期
- DOM 顺序不一定是日期顺序，需要**按日期排序后**再点击
- OneTrust/弹层可能拦截点击，需要清理或强制点击
- PowerShell 受执行策略限制，`agent-browser` 需 `cmd /c` 执行
- Playwright 依赖下载可能失败（ECONNRESET），需改用系统 Chrome 或重试

## 关键规则
- 只抓取属于 `ng-style` 目标集的日期
- 禁用态日期也要强制点击并抓取
- 点击顺序以日期排序为准（`aria-label` 解析）

