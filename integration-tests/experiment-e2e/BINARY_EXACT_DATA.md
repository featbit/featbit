# 2,000 UUID 用户的精确 Binary 数据程序

版本：`exact-binary-2000-v1`。入口：[run-binary-exact-data.ps1](./run-binary-exact-data.ps1)。
使用官方 `FeatBit.ServerSdk 1.2.11`，复用现有项目的连接配置；与六个概率场景的数据入口分别调用。

对 `e2e-scenario-balanced` 的 2,000 个不同 UUID 用户，各调用一次真实 `BoolVariationDetail`。
UUID 在离线预览时固定，正式执行按实际 true/false 结果分组，再在各组内按 evaluation 顺序选取前 N 人。
不增加探测 evaluation，不预筛 Layer，不补选用户，不强制 true/false 各 1,000 人。
不同 metric 允许选中同一用户。三个 metric 的 `guarail` 拼写与现有 key 一致。

| Metric | true 用户数 | true Track 次数 | true value 总和 | false 用户数 | false Track 次数 | false value 总和 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `binary-primary-metric` | 153 | 153 | 153 | 88 | 88 | 88 |
| `numeric-count-all-guarail-metric` | 100 | 120 | 120 | 100 | 210 | 210 |
| `numeric-sum-guarail-metric` | 50 | 50 | 1201 | 50 | 50 | 2210 |

总计 **2,000 次 evaluation、671 次 Track**。所有事件都使用对应 UUID 作为 user key。

- Binary：每个选中用户 Track 一次，value 为 1。
- Count：true 中 80 人各一次、20 人各两次；false 中 90 人各两次、10 人各三次。每次 value 为 1，聚合统计事件次数。
- Sum：true 中 49 人各写入 24、1 人写入 25；false 中 40 人各写入 44、10 人各写入 45。每个选中用户 Track 一次。

## 离线预览与检查

在仓库根目录执行，需要 .NET 10 SDK：

```powershell
.\integration-tests\experiment-e2e\run-binary-exact-data.ps1 -Action self-check
.\integration-tests\experiment-e2e\run-binary-exact-data.ps1 -SessionId binary-exact-20260909
```

默认 Action 为 `preview`。预览不创建 SDK，不连接 API，不调用 evaluation/Track。
首次构建可能需要从 NuGet 还原包；已构建后可加 `-NoBuild` 跳过构建和还原。
它保存 `reports/<SessionId>/exact-binary/plan.json`（完整 UUID 名单）和 `preview.md`。
再次预览同一个 Session 保留同一批 UUID。预览中的真实 true/false 人数为空，只有正式执行后才能确定。

离线自检使用明确标识的虚拟评估结果，检查 UUID 合法性、六组配额、事件次数、value 总和，以及人数不足时的停止逻辑。
离线自检通过不代表 SDK 投递或数据库入库通过。

## 正式注入（需要显式选择）

默认仅预览。确认正式执行时使用以下命令；已有注入记录的 Session 不得再次运行 inject：

```powershell
.\integration-tests\experiment-e2e\run-binary-exact-data.ps1 `
  -Action inject -SessionId binary-exact-20260909
```

复用 `ui-data-runner/config.local.json`，或通过 `-Config` 指定当前本地项目/环境/API/Event/Streaming 地址。
凭据通过进程环境变量 `FEATBIT_UI_ACCESS_TOKEN` 或 `FEATBIT_UI_LOGIN_EMAIL` / `FEATBIT_UI_LOGIN_PASSWORD` 提供；SDK key 从目标环境读取，凭据不写报告。

执行前检查现有实验 `e2e-bayesian-binary-primary` 的 Run 1、三个 metric 和环境身份。
Flag 必须 ON，Default split 为 50% / 50%，Targeting rules 和 Individual targeting 为空，实验采集覆盖全部用户。每次实际 SDK 返回还须为 `ReasonKind.Fallthrough`，并保存 Kind/Reason，防止旧 rules 或 OFF 结果混入。
Run 无 Layer、无 Audience filters、各变体 Analysis sampling 为 100%。程序只检查，不修改这些配置或观察窗口。

程序先完成全部 2,000 次 evaluation，并通过统计 API 确认对应窗口的曝光全部入库且 metrics 仍为空，然后发送 671 次 Track。
true 少于 153 人或 false 少于 100 人时，不产生 metric，不追加 evaluation；已经产生的曝光保留在数据库。
SDK 超时、投递失败、入库缺数或配置变化时停止并保留证据。SDK flush 成功本身不等于数据入库成功。

同一 Session 一旦开始注入就拒绝再次注入，包括中断或失败情况。不要换 Session 重跑来掩盖缺数；先检查原始事件与调用记录。

## 数据对账与 UI 分母

正式执行完成后自动对账；之后可仅重新查询：

```powershell
.\integration-tests\experiment-e2e\run-binary-exact-data.ps1 `
  -Action verify -SessionId binary-exact-20260909
```

`verify` 不重发事件、不执行 evaluation、不调用 Analyze。它查询保存的 flag / 时间窗口，并对账 users、conversions、sumValue、sumSquares、avgValue 和 conversionRate。
查询不带 RunId，不写入 Run assignments。这是聚合对账；若同一窗口有其他程序对同一 flag 发流量，会导致不一致，不自动删除或修正数据。

保存的证据：

- `receipt.json`：目标、状态、调用次数与起止时间；有注入意图就禁止重放。
- `calls.jsonl`：每次 evaluation/Track 前的 intent 与返回后的记录。
- `exposures.json`：全部真实 true/false 结果。
- `track-plan.json`：按真实结果选出的完整 metric 事件计划。
- `users.json`：成功发送后的逐用户曝光与 metric 账本；异常时为 `partial-users.json`。
- `exposure-check.json`、`verification.json`：入库查询、预期值与断言。
- `result.md`：入库通过后写入的结果摘要。

三个 metric 的 **Samples (n)** 都应为实际曝光的 `N_true` / `N_false`，总计 2,000，包含没有 Track 的用户。
Binary rate 分别为 `153/N_true`、`88/N_false`；Count 的 Events/user 为 `120/N_true`、`210/N_false`；Sum 的 Value/user 为 `1201/N_true`、`2210/N_false`。
UI 观察窗口必须覆盖整批数据，然后手动 Analyze；程序不会刷新旧分析，也不会把预览写成真实分析结果。
