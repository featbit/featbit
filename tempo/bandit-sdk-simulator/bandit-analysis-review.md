# Bandit 实验检查记录

检查日期：2026-09-08。范围：指标配置 → 按 Flag/观察窗口查询 → PostgreSQL/MongoDB 分析 → API 数据结构 → 当前 React 页面及 tooltip。

## 截图中的问题

指标的显示方式应由指标类型和聚合方式决定，不能由 primary/guardrail 位置决定。

| 指标 | 当前定义 | 作为 primary | 作为 guardrail |
| --- | --- | --- | --- |
| `bandit_arms_metric_1` | binary / once | Events、Rate | Events、Rate |
| `bandit_arms_metric_2` | numeric / count | Events / user | Events / user |
| numeric / sum | 每个用户的事件数值求和 | Value / user (sum) | Value / user (sum) |
| numeric / average | 每个用户的事件数值平均 | Value / user (avg) | Value / user (avg) |

`Rate` 是发生过事件的用户比例；`Events / user` 是人均事件次数，可以大于 1。将 3.1227 显示成 312.3% 是展示错误，不代表转换率超过 100%。

真正空的查询返回 `Variants=[]` 时，原来的护栏分析根据数据行是否含 `k` 推断类型，因而把没有数据的二元指标误判成 numeric，页面显示 Mean。这是上一次修复没有覆盖到的边界：含有零样本行，与完全没有数据行，不是同一种输入。

## 已修复

1. Bandit 主指标在 API 中明确返回类型和聚合方式；二元指标返回 conversions/rate，数值指标返回 mean。前端兼容旧数值结果中错误使用 rate 存放均值的格式。
2. Bandit 护栏构造使用运行配置声明的指标类型，空查询也保留 binary/once。旧缓存结果仅在对应运行明确声明二元护栏且所有行均无样本时修正类型，不用 `once` 聚合猜测类型。
3. Bandit 单独使用指标定义说明和比较说明。主指标解释 P(best) 与建议权重；护栏解释配置的有害方向、P(harm) 和相对变化的 95% 可信区间。原有 Bayesian A/B tooltip 保留。
4. Burn-in 显示算法实际要求的每个 arm 至少 100 个用户。之前显示的 ≥0 来自错误读取 Bayesian 的样本门槛字段。
5. 未完成 burn-in 时，P(best)、建议权重和最佳 arm 返回不可用，而不是概率为零。页面显示 `—`；零样本时比例/均值与 SRM 判断也显示不可评估。
6. Bandit 后验计算不再因为观测方差为零就丢弃已观测均值。恒定数值、全部转化和全部未转化的场景已有回归覆盖。只修改 Bandit 的 `ArmPosterior`，未改 Bayesian 的比较函数。
7. 算法显示名称改为 `Posterior sampling (top-two allocation)` / `后验采样（前两名分配）`，与当前实现相符。API 内部算法标识保留，现有前两名分票策略保留。

## 为什么第二个实验仍没有样本

同一个事件指标可以被多个实验引用，但各实验需要匹配自己的 Flag 曝光、变体、观察窗口和筛选条件。

| 实验 | Flag | 检查时的观察窗口（北京时间） | 匹配样本 |
| --- | --- | --- | --- |
| bandit arms | `rd-onboarding-flow-ui-e2e-20260904-1417` | 2026-09-07 16:15 起 | 4,000 |
| bandit arms 2 | `rd-e2e-scenario-layer-30-skewed-80-20-to-20-20-ui-e2e-20260904-1417` | 当前 run-2：2026-09-08 17:04 起 | 0 |

第二个实验的 0 样本是当前查询结果，不是交换指标导致第一批数据消失。其 `bandit_arms_metric_1` 护栏配置为 `increase_bad` / `inverse=true`，所以显示 Lower is better；方向不是由 primary/guardrail 位置自动反转。本次没有修改这些 Flag、窗口、指标方向或流量配置。

## Bandit 与 Bayesian 的代码边界

| 部分 | 边界 |
| --- | --- |
| 分析入口和顶层结果 | 按运行 method 分支，`BuildBanditAnalysisJson` 与 `BuildBayesianAnalysisJson` 独立 |
| Bandit 推荐 | `ComputeBanditWeights`、`ArmPosterior` 属于 Bandit 路径 |
| 护栏构造 | 本次增加 Bandit 专用 `BuildBanditGuardrailSections`；原 `BuildGuardrailSections` 仍服务 Bayesian |
| 基础比较统计 | 部分共享，例如 `ComputeMetricSection`、`BayesianResult`、相对变化和风险计算 |
| 页面 | 共用表格基础组件；按 method、指标类型和主指标/护栏角色选择展示与说明 |

所以它们不是完全复制出来的两套代码。Bandit 是使用指标结果推荐流量的实验模式；其护栏目前确实使用贝叶斯比较统计。原 tooltip 提到 Bayesian 并不说明实验被切换成 Bayesian A/B，但那种表达混淆了实验模式和计算方法，因此已改为直接解释这个护栏在做什么。

共享 `ComputeMetricSection` 新增的声明类型参数只由 Bandit 传入，Bayesian 保留原默认路径。两种存储实现中的 `BuildBayesianAnalysisJson`、`BuildGuardrailSections`、`BayesianResult`、`DeterministicComparison`、`DeltaMethodSe`、`Risk` 函数与修改前一致。

## 推荐算法与现有使用边界

当前实现每次抽取各 arm 的后验表现，分别给第一名和第二名分票，然后汇总权重。因此 P(best) 衡量夺得第一的概率，建议权重不是 P(best) 的直接复制；一个几乎确定最优的 arm 仍可能得到约 49% 建议权重。

严格的 Top-Two Thompson Sampling 会通过继续采样寻找不同的候选者，不能仅因为实现使用了两个名次就认为二者等价。显示名称此次按实际行为收敛，未替换整套分配算法。参考：[Russo, Simple Bayesian Algorithms for Best Arm Identification](https://arxiv.org/abs/1602.08448)。

本次检查还确认了以下现有行为，不能将它们理解为已完成的自动发布保护：

- 护栏风险不会自动否决或调整主指标给出的推荐权重。`Stopping: Met` 只表示主指标达到当前概率条件，不表示所有护栏通过。
- 当前 SRM 以各 arm 等额样本为期望。当前第一组模拟数据是等额分流；如果后续采用不等额或随时间变化的流量分配，需要结合实际曝光分配概率判断 SRM，不能直接把这个等额检验当作有效性结论。本次未修改共享 SRM 算法。
- 相对变化需要可用的基线均值。基线为零时，当前相对变化/风险结果可能不可计算；显示 `—` 或 no data 不表示护栏安全。没有模拟延迟事件时，数值汇总为零也不能证明延迟没有风险。

## 验证结果

- 前端 measuring 回归：26 个测试通过；覆盖交换指标、旧格式、空二元护栏、数值 count/sum/average、burn-in 与 Bayesian 显示边界。
- 后端分析与契约回归：40 个测试通过；PostgreSQL、MongoDB 均覆盖，包括真正空查询、0/99/100 样本、恒定观测和相同数据下的护栏结果一致性。
- TypeScript 类型检查、修改文件的 ESLint/Prettier 检查、`git diff --check` 通过。
- 使用现有 Aspire 环境重建 API，在实际页面验证两个 Bandit 实验。第二个实验的旧结果及重新分析结果均显示 Events / Rate，未评估概率显示 `—`，实际门槛为 100。
- 对一个已有的闭合观察窗口 Bayesian A/B 实验，在修复前后重新分析；去掉 `computed_at` 后，完整分析 JSON 完全相同。页面原有 tooltip、后验图、500 用户门槛保持原样。

这些检查验证了本次变更及所列边界，不等于对整个统计引擎完成独立科学验证。代码保留在工作区，未提交或推送；本记录与模拟项目均位于忽略的临时目录。
