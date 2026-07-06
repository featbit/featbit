import i18n from "i18next"
import { initReactI18next } from "react-i18next"

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: {
        auth: {
          hero: {
            title: "Release with confidence",
            subtitle: "Ship better features. Safely. At scale.",
          },
          login: {
            title: "Sign in to your workspace",
            subtitle: "Welcome back! Please sign in to continue.",
          },
          sso: {
            title: "Sign in with SSO",
            subtitle: "Enter your workspace key to continue.",
          },
          email: "Email",
          password: "Password",
          passwordPlaceholder: "Enter your password",
          remember: "Remember me",
          forgot: "Forgot password?",
          signIn: "Sign in",
          signingIn: "Signing in...",
          continueWith: "or sign up/in with",
          enterprise: "Enterprise sign-in",
          ssoButton: "Sign in with SSO",
          backToSignIn: "Back to sign in",
          workspaceKey: "Workspace key",
          continueSso: "Continue with SSO",
          errors: {
            incorrectEmailOrPassword: "Email and/or password incorrect",
            loginError: "Error occurred, please contact the support.",
            workspaceKeyRequired: "Workspace key is required",
          },
        },
        selectWorkspace: {
          workspace: {
            title: "Select a workspace",
            subtitle: "Choose a workspace to continue as {{email}}.",
            search: "Search workspaces...",
            empty: "No workspaces found.",
          },
          organization: {
            title: "Select an organization",
            subtitle: "Choose an organization to continue as {{email}}.",
            search: "Search organizations...",
            empty: "No organizations found.",
            noneTitle: "No organizations available",
            noneDescription:
              "There are no organizations available in this workspace.",
          },
          backToWorkspaces: "Back to workspaces",
          signInWithAnotherEmail: "Sign in with another email",
          errors: {
            loadWorkspaces: "Unable to load workspaces. Please try again.",
            loadOrganizations:
              "Unable to load organizations. Please try again.",
            joinOrganization:
              "Unable to join this organization. Please try again.",
          },
        },
        onboarding: {
          title: "Set up your first organization",
          subtitle:
            "Create the basic structure FeatBit needs before you start releasing features.",
          complete: "Complete setup",
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
              "FeatBit will create Dev and Prod environments with SDK secrets for your first project.",
          },
          preview: {
            title: "Setup preview",
            organizationFallback: "Organization",
            projectFallback: "Example project",
            sdkSecret: "SDK secret",
          },
          errors: {
            submit: "Unable to complete onboarding. Please try again.",
          },
        },
        layout: {
          placeholder: "Authenticated layout ready. Page content will migrate in later steps.",
          sidebar: {
            collapse: "Collapse sidebar",
            expand: "Expand sidebar",
          },
          nav: {
            groups: {
              getStarted: "Get Started",
              release: "Release",
              experimentation: "Experimentation",
              governance: "Governance",
              integrations: "Integrations",
              admin: "Admin",
            },
            items: {
              getStarted: "Get Started",
              featureFlags: "Feature Flags",
              segments: "Segments",
              endUsers: "End Users",
              experiments: "Experiments",
              metrics: "Metrics",
              auditLogs: "Audit Logs",
              changeRequests: "Change Requests",
              workspace: "Workspace",
              organization: "Organization",
              iam: "IAM",
              team: "Team",
              groups: "Groups",
              policies: "Policies",
              relayProxies: "Relay Proxies",
              integrations: "Integrations",
              webhooks: "Webhooks",
              accessTokens: "Access Tokens",
            },
          },
          context: {
            searchEnvironments: "Search environments...",
            noEnvironments: "No environments found.",
            manageEnvironments: "Manage environments",
          },
          plan: {
            aria: "{{label}}: {{plan}}",
            free: "Free Plan",
            upgradeNow: "Upgrade Now",
            current: "Current Plan",
            enterprise: "Enterprise",
            getEnterprise: "Get Enterprise",
          },
          account: {
            account: "Account",
            profile: "Profile",
            support: "Support",
            documentation: "Documentation",
            language: "Language",
            english: "English",
            chinese: "中文",
            version: "Version: {{version}}",
            signOut: "Sign out",
            theme: {
              label: "Theme",
              light: "Light",
              dark: "Dark",
              system: "System",
            },
          },
        },
        workspace: {
          title: "Workspace",
          operationSucceeded: "Operation succeeded",
          requestFailed: "Request failed",
          saving: "Saving",
          tabs: {
            aria: "Workspace sections",
            general: "General",
            license: "License",
            usage: "Usage",
            billing: "Billing",
            globalUsers: "Global Users",
          },
          validation: {
            required: "This field is required",
            url: "Enter a valid URL",
            keyUsed: "This key has been used",
          },
          general: {
            accessConfiguration: "Access configuration",
            identity: {
              name: "Name",
              key: "Key",
              helper:
                "These settings identify your workspace and are used across FeatBit.",
              save: "Save changes",
              permissionNote:
                "You need workspace administrator permissions to update these settings.",
            },
            sso: {
              title: "Single sign-on",
              clientId: "Client ID",
              clientSecret: "Client secret",
              tokenEndpoint: "Token endpoint",
              clientAuthenticationMethod: "Client authentication method",
              authorizationEndpoint: "Authorization endpoint",
              scope: "Scope",
              userEmailClaim: "User email claim",
              helper:
                "SSO settings are used to authenticate users via your identity provider.",
              save: "Save SSO settings",
              showSecret: "Show client secret",
              hideSecret: "Hide client secret",
              restrictedBadge: "Restricted",
              restrictedDescription:
                "You do not have permission to view or edit SSO settings.",
              unlicensedBadge: "License required",
              unlicensedDescription:
                "Single sign-on is a paid feature. Add a license that includes SSO to enable it for this workspace.",
            },
          },
        },
        shell: {
          eyebrow: "FeatBit React migration",
          login: {
            title: "Login route ready",
            description:
              "The app foundation is wired. The redesigned login page will migrate in the next step.",
          },
          sso: {
            title: "SSO route ready",
            description:
              "The localized SSO entry point is available without migrating the old UI.",
          },
          app: {
            title: "Application shell ready",
            description:
              "Routing, providers, theme, runtime env, and i18n are now available in front-end-v2.",
          },
          version: "Version: {{version}}",
        },
      },
    },
    zh: {
      common: {
        auth: {
          hero: {
            title: "自信发布",
            subtitle: "更安全、更稳定、更规模化地交付功能。",
          },
          login: {
            title: "登录工作区",
            subtitle: "欢迎回来，请登录后继续。",
          },
          sso: {
            title: "使用 SSO 登录",
            subtitle: "输入工作区 key 继续。",
          },
          email: "邮箱",
          password: "密码",
          passwordPlaceholder: "输入密码",
          remember: "记住我",
          forgot: "忘记密码？",
          signIn: "登录",
          signingIn: "正在登录...",
          continueWith: "或使用以下方式注册/登录",
          enterprise: "企业登录",
          ssoButton: "使用 SSO 登录",
          backToSignIn: "返回登录",
          workspaceKey: "工作区 key",
          continueSso: "继续使用 SSO",
          errors: {
            incorrectEmailOrPassword: "邮箱或密码不正确",
            loginError: "发生错误，请联系支持团队。",
            workspaceKeyRequired: "请输入工作区 key",
          },
        },
        selectWorkspace: {
          workspace: {
            title: "选择工作区",
            subtitle: "请选择一个工作区，以 {{email}} 的身份继续。",
            search: "搜索工作区...",
            empty: "未找到工作区。",
          },
          organization: {
            title: "选择组织",
            subtitle: "请选择一个组织，以 {{email}} 的身份继续。",
            search: "搜索组织...",
            empty: "未找到组织。",
            noneTitle: "没有可用组织",
            noneDescription: "当前工作区下没有可用组织。",
          },
          backToWorkspaces: "返回工作区",
          signInWithAnotherEmail: "使用其他邮箱登录",
          errors: {
            loadWorkspaces: "无法加载工作区，请重试。",
            loadOrganizations: "无法加载组织，请重试。",
            joinOrganization: "无法加入该组织，请重试。",
          },
        },
        onboarding: {
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
            helper: "FeatBit 会为你的第一个项目创建 Dev 和 Prod 环境及 SDK 密钥。",
          },
          preview: {
            title: "设置预览",
            organizationFallback: "组织",
            projectFallback: "Example project",
            sdkSecret: "SDK 密钥",
          },
          errors: {
            submit: "无法完成初始化，请重试。",
          },
        },
        layout: {
          placeholder: "认证布局已就绪，页面内容将在后续步骤迁移。",
          sidebar: {
            collapse: "收起侧边栏",
            expand: "展开侧边栏",
          },
          nav: {
            groups: {
              getStarted: "开始",
              release: "发布",
              experimentation: "实验",
              governance: "治理",
              integrations: "集成",
              admin: "管理",
            },
            items: {
              getStarted: "开始",
              featureFlags: "功能开关",
              segments: "用户分群",
              endUsers: "终端用户",
              experiments: "实验",
              metrics: "指标",
              auditLogs: "审计日志",
              changeRequests: "变更请求",
              workspace: "工作区",
              organization: "组织",
              iam: "IAM",
              team: "团队",
              groups: "用户组",
              policies: "策略",
              relayProxies: "Relay 代理",
              integrations: "集成",
              webhooks: "Webhooks",
              accessTokens: "访问令牌",
            },
          },
          context: {
            searchEnvironments: "搜索环境...",
            noEnvironments: "没有找到环境。",
            manageEnvironments: "管理环境",
          },
          plan: {
            aria: "{{label}}：{{plan}}",
            free: "免费版",
            upgradeNow: "立即升级",
            current: "当前套餐",
            enterprise: "企业版",
            getEnterprise: "获取企业版",
          },
          account: {
            account: "账户",
            profile: "个人资料",
            support: "支持",
            documentation: "文档",
            language: "语言",
            english: "English",
            chinese: "中文",
            version: "版本：{{version}}",
            signOut: "退出登录",
            theme: {
              label: "主题",
              light: "浅色",
              dark: "深色",
              system: "跟随系统",
            },
          },
        },
        workspace: {
          title: "工作区",
          operationSucceeded: "操作成功",
          requestFailed: "请求失败",
          saving: "保存中",
          tabs: {
            aria: "工作区页面",
            general: "通用",
            license: "许可证",
            usage: "用量",
            billing: "账单",
            globalUsers: "全局用户",
          },
          validation: {
            required: "此字段不能为空",
            url: "请输入有效 URL",
            keyUsed: "该 Key 已被使用",
          },
          general: {
            accessConfiguration: "访问配置",
            identity: {
              name: "名称",
              key: "Key",
              helper: "这些设置用于标识工作区，并会在 FeatBit 中使用。",
              save: "保存更改",
              permissionNote: "需要工作区管理员权限才能更新这些设置。",
            },
            sso: {
              title: "单点登录",
              clientId: "Client ID",
              clientSecret: "Client secret",
              tokenEndpoint: "Token endpoint",
              clientAuthenticationMethod: "Client authentication method",
              authorizationEndpoint: "Authorization endpoint",
              scope: "Scope",
              userEmailClaim: "User email claim",
              helper: "SSO 设置用于通过身份提供商认证用户。",
              save: "保存 SSO 设置",
              showSecret: "显示 client secret",
              hideSecret: "隐藏 client secret",
              restrictedBadge: "受限",
              restrictedDescription: "你没有权限查看或编辑 SSO 设置。",
              unlicensedBadge: "需要许可证",
              unlicensedDescription:
                "单点登录是付费功能。请添加包含 SSO 的许可证以启用该功能。",
            },
          },
        },
        shell: {
          eyebrow: "FeatBit React migration",
          login: {
            title: "Login route ready",
            description:
              "The app foundation is wired. The redesigned login page will migrate in the next step.",
          },
          sso: {
            title: "SSO route ready",
            description:
              "The localized SSO entry point is available without migrating the old UI.",
          },
          app: {
            title: "Application shell ready",
            description:
              "Routing, providers, theme, runtime env, and i18n are now available in front-end-v2.",
          },
          version: "Version: {{version}}",
        },
      },
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
})

export { i18n }
