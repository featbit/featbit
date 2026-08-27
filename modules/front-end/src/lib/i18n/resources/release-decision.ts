export const enReleaseDecision = {
  status: "In development",
  experiments: {
    title: "Experiments",
    subtitle:
      "Run controlled experiments and compare outcomes with confidence.",
    comingSoon: "Experiments are coming soon",
    description:
      "We’re building a focused workflow for running experiments and understanding their impact. It’ll be available here soon.",
  },
  metrics: {
    title: "Metrics",
    subtitle: "Define the measures that tell you whether a change is working.",
    comingSoon: "Metrics are coming soon",
    description:
      "We’re building a reusable metrics catalog for measuring experiment outcomes. It’ll be available here soon.",
  },
  layers: {
    title: "Layers",
    subtitle:
      "Coordinate mutually exclusive experiments across shared traffic.",
    comingSoon: "Layers are coming soon",
    description:
      "We’re building a layer registry for assigning experiments to non-overlapping bucket ranges. It’ll be available here soon.",
  },
} as const

export const zhReleaseDecision = {
  status: "开发中",
  experiments: {
    title: "实验",
    subtitle: "运行受控实验，自信地比较结果。",
    comingSoon: "实验功能即将上线",
    description:
      "我们正在构建一套专注的实验工作流，帮助你运行实验并理解其影响。该功能即将在此提供。",
  },
  metrics: {
    title: "指标",
    subtitle: "定义用于判断变更是否有效的衡量标准。",
    comingSoon: "指标功能即将上线",
    description:
      "我们正在构建可复用的指标目录，用于衡量实验结果。该功能即将在此提供。",
  },
  layers: {
    title: "互斥层",
    subtitle: "协调共享流量中的互斥实验。",
    comingSoon: "互斥层功能即将上线",
    description:
      "我们正在构建互斥层注册表，用于将实验分配到互不重叠的流量桶区间。该功能即将在此提供。",
  },
} as const
