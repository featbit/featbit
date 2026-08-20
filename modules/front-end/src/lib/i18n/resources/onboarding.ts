export const enOnboarding = {
  title: "Set up your first organization",
  subtitle:
    "Create the basic structure FeatBit needs before you start releasing features.",
  complete: "Complete setup",
  recovery: {
    title: "Create your example project",
    subtitle:
      "This organization has no projects yet. Create an example project with Dev and Prod environments to continue.",
    complete: "Create project",
  },
  noAccessibleProjects: {
    title: "Create a project",
    subtitle:
      "You don't currently have access to any projects. Create a new project to continue.",
    complete: "Create project",
    environmentsHelper:
      "FeatBit will create Dev and Prod environments with SDK secrets for this project.",
  },
  organization: {
    section: "Organization",
    name: "Organization name",
    placeholder: "Acme Inc.",
    helper:
      "This is the top-level space for teams, projects, and access control.",
  },
  project: {
    section: "Project",
    name: "Project name",
    key: "Project key",
    namePlaceholder: "Example project",
    keyPlaceholder: "example-project",
    helper:
      "Project keys are generated from the name and used in SDK configuration.",
  },
  environments: {
    section: "Environments",
    helper:
      "FeatBit will create Dev and Prod environments with SDK secrets for this project.",
  },
  preview: {
    title: "Setup preview",
    organizationFallback: "Organization",
    projectFallback: "Example project",
    sdkSecret: "SDK secret",
  },
  errors: {
    submit: "Unable to complete setup. Please try again.",
    projectSubmit: "Unable to create the project. Please try again.",
    projectPermissionDenied:
      "A permission rule prevents you from accessing this new project or its environments. Ask a workspace administrator to update your permissions, then try again.",
  },
} as const

export const zhOnboarding = {
  noAccessibleProjects: {
    title: "创建项目",
    subtitle: "你目前没有可访问的项目。请创建一个新项目以继续。",
    complete: "创建项目",
    environmentsHelper:
      "FeatBit 将为该项目创建 Dev 和 Prod 环境以及 SDK 密钥。",
  },
  recovery: {
    title: "创建示例项目",
    subtitle:
      "此组织还没有项目。创建一个包含 Dev 和 Prod 环境的示例项目以继续。",
    complete: "创建项目",
  },
  title: "设置你的第一个组织",
  subtitle: "在开始发布功能前，先创建 FeatBit 所需的基础结构。",
  complete: "完成设置",
  organization: {
    section: "组织",
    name: "组织名称",
    placeholder: "Acme Inc.",
    helper: "组织是团队、项目和访问控制的顶层空间。",
  },
  project: {
    section: "项目",
    name: "项目名称",
    key: "项目 key",
    namePlaceholder: "Example project",
    keyPlaceholder: "example-project",
    helper: "项目 key 会根据名称生成，并用于 SDK 配置。",
  },
  environments: {
    section: "环境",
    helper: "FeatBit 会为此项目创建 Dev 和 Prod 环境及 SDK 密钥。",
  },
  preview: {
    title: "设置预览",
    organizationFallback: "组织",
    projectFallback: "Example project",
    sdkSecret: "SDK 密钥",
  },
  errors: {
    submit: "无法完成设置，请重试。",
    projectSubmit: "无法创建项目，请重试。",
    projectPermissionDenied:
      "权限规则阻止你访问这个新项目或其环境。请联系工作区管理员更新你的权限，然后重试。",
  },
} as const
