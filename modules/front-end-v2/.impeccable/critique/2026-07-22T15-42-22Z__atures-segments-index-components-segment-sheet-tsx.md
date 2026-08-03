---
target: Segment type selector in New Segment Sheet
total_score: 25
p0_count: 0
p1_count: 1
timestamp: 2026-07-22T15-42-22Z
slug: atures-segments-index-components-segment-sheet-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | 选中态清楚，但许可证限制在选择后才出现。 |
| 2 | Match System / Real World | 2/4 | “Current environment”描述范围，“Shareable”描述能力，概念不平行。 |
| 3 | User Control and Freedom | 3/4 | 可以切回或取消，但选择受限类型后表单整体消失。 |
| 4 | Consistency and Standards | 3/4 | 控件与 token 一致，但比 Relay Proxy 的同类选择器缺少决策说明。 |
| 5 | Error Prevention | 2/4 | 默认值安全，但受限选项看起来完全可用。 |
| 6 | Recognition Rather Than Recall | 2/4 | 关键差异藏在 tooltip 中。 |
| 7 | Flexibility and Efficiency | 3/4 | 两个直接选项、整卡点击和键盘单选行为高效。 |
| 8 | Aesthetic and Minimalist Design | 3/4 | 紧凑克制，但两项的信息密度不对称。 |
| 9 | Error Recovery | 2/4 | 许可证说明没有直接下一步。 |
| 10 | Help and Documentation | 2/4 | 有上下文帮助，但入口较隐蔽且不可行动。 |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

这部分不像 AI 生成的界面。它使用熟悉的 RadioGroup、克制的颜色、常规圆角和项目已有的组件语言，没有装饰性图标、阴影或多余动画。确定性扫描返回 0 项问题。主要缺陷不是视觉花哨，而是选择后果与许可证限制没有在决策点直接呈现。

## Overall Impression

当前 Segment type 视觉上合格：紧凑、选中态明确、点击区域足够。最大机会是让两个选项在语义上可直接比较，并避免 Shareable 成为选择后才暴露的许可证死路。

## What's Working

- 选中态同时使用 radio、边框和浅色背景，不只依赖颜色。
- 两项并排时密度合适，窄屏会堆叠，整卡点击区域足够。
- 默认选择 Current environment，符合风险较低的默认策略。

## Priority Issues

### [P1] Shareable 的许可证限制出现得太晚

受限选项看起来与普通选项相同，用户选择后表单整体被许可证提示替换，容易形成“被引导进死路”的感受。应在选项本身显示简短的 License required 状态；受限时可禁用但保持可理解，或允许选择但保持表单上下文并禁用提交。许可证提示应提供明确的下一步。

### [P2] 两个选项的命名不平行

Current environment 是位置，Shareable 是能力。首次使用者无法直接比较实际选择是“单一环境”还是“多个范围”。建议使用平行的用户决策语言，例如 This environment 与 Multiple scopes；如 Shareable 是既有术语，可作为辅助文本保留。

### [P2] 分组与键盘焦点语义弱于视觉卡片

可见的 Segment type 标签没有明确成为 radiogroup 的可访问名称；键盘焦点主要落在小 radio 上，而视觉上整张卡片才是控件。应为 RadioGroup 建立可访问名称，并用 focus-within 让整卡显示焦点。

### [P3] 信息密度不对称

较窄宽度下 Current environment 可能换行而 Shareable 保持单行。单纯继续加宽只能缓解，不能解决语义不可比的问题。若增加辅助说明，应保持一行或非常短，避免重新变高。

## Persona Red Flags

**Jordan（首次使用者）**：无法从 Shareable 判断它是公开、跨环境还是跨 Feature Flag；需要发现小型 info 图标才能理解关键差异；许可证限制在选择后才出现。

**Sam（键盘或屏幕阅读器用户）**：radio 本身有名称，但组名关联不足；整卡选中态强而整卡焦点态弱；表单切换成许可证提示可能缺少结构连续性。

**Casey（窄屏或易分心用户）**：堆叠与触控尺寸合格，但选择 Shareable 后表单消失，容易误以为已填写内容丢失；许可证提示没有直接可点击的后续动作。

## Minor Observations

- tooltip 触发器视觉尺寸较小。
- selected card 的 ring 与主色边框功能有些重复。
- Sheet 已移除副标题，因此类型选择器承担了更多解释责任。

## Questions to Consider

- Shareable 不可用时，它应该还是可选择项，还是带许可证状态的能力预览？
- Shareable 是必须保留的产品术语，还是可以把用户决策直接表述为单一环境与多个范围？
- 类型切换是否应该让其余表单消失，还是只改变 Scope 区域与提交资格？
