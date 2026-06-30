import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: {
        auth: {
          hero: {
            title: "Release with confidence",
            subtitle: "Ship better features. Safely. At scale."
          },
          login: {
            title: "Sign in to your workspace",
            subtitle: "Welcome back! Please sign in to continue."
          },
          sso: {
            title: "Sign in with SSO",
            subtitle: "Enter your workspace key to continue"
          },
          email: "Email",
          password: "Password",
          passwordPlaceholder: "Enter your password",
          remember: "Remember me",
          forgot: "Forgot password?",
          signIn: "Sign in",
          continueWith: "or sign up/in with",
          enterprise: "Enterprise sign-in",
          ssoButton: "Sign in with SSO",
          backToSignIn: "Back to sign in",
          workspaceKey: "Workspace key",
          continueSso: "Continue with SSO",
          errors: {
            incorrectEmailOrPassword: "Email and/or password incorrect",
            loginError: "Error occurred, please contact the support."
          }
        },
        layout: {
          nav: {
            groups: {
              getStarted: "Get Started",
              release: "Release",
              governance: "Governance",
              experimentation: "Experimentation",
              integrations: "Integrations",
              admin: "Admin"
            },
            items: {
              getStarted: "Get Started",
              featureFlags: "Feature Flags",
              segments: "Segments",
              endUsers: "End Users",
              auditLogs: "Audit Logs",
              changeRequests: "Change Requests",
              experiments: "Experiments",
              metrics: "Metrics",
              relayProxies: "Relay Proxies",
              webhooks: "WebHooks",
              accessTokens: "Access Tokens",
              workspace: "Workspace",
              organization: "Organization",
              iam: "IAM",
              teams: "Teams",
              groups: "Groups",
              policies: "Policies"
            }
          },
          sidebar: {
            collapse: "Collapse sidebar",
            expand: "Expand sidebar"
          },
          plan: {
            current: "Current Plan",
            free: "Free Plan",
            upgradeNow: "Upgrade Now",
            expired: "License Expired",
            expiringSoon: "Expiring in {{days}} days",
            getEnterprise: "Get Enterprise",
            aria: "{{label}}, {{plan}}"
          },
          context: {
            searchEnvironments: "Search environments",
            manageEnvironments: "Manage environments"
          },
          environment: {
            production: "Production",
            staging: "Staging",
            development: "Development"
          },
          account: {
            account: "Account",
            profile: "Profile",
            support: "Support",
            documentation: "Documentation",
            language: "Language",
            english: "English",
            chinese: "中文",
            theme: {
              label: "Theme",
              light: "Light",
              dark: "Dark",
              system: "System"
            },
            version: "Version: {{version}}",
            signOut: "Sign out"
          },
          placeholder: "Content will be added in the next migration steps."
        },
        selectWorkspace: {
          workspace: {
            title: "Select a workspace",
            subtitle: "Workspaces for {{email}}",
            search: "Search workspaces",
            empty: "No workspaces match your search."
          },
          organization: {
            title: "Select an organization",
            subtitle: "Organizations for {{email}}",
            search: "Search organizations",
            empty: "No organizations match your search.",
            noneTitle: "No organizations found",
            noneDescription: "You don't have any organization yet. Please contact your admin to add you to an organization."
          },
          backToWorkspaces: "Back to workspaces",
          signInWithAnotherEmail: "Sign in with another email",
          errors: {
            loadWorkspaces: "Failed to load workspaces. Please try again.",
            loadOrganizations: "Failed to load organizations. Please try again.",
            joinOrganization: "Error happened, please login again."
          }
        },
        onboarding: {
          eyebrow: "Workspace onboarding",
          title: "Set up your organization",
          subtitle: "Create your first project and environments so your team can start shipping flags.",
          formTitle: "Configure launch context",
          formDescription: "These values become the top-level organization, the first project, and the default environment pair.",
          complete: "Complete setup",
          signOut: "Sign out",
          stats: {
            organization: "Organization",
            project: "Project key",
            environments: "Environments"
          },
          organization: {
            section: "Organization",
            sectionDescription: "Name the organization that owns projects, members, and workspace-level governance.",
            name: "Organization name",
            key: "Organization key",
            placeholder: "Default Organization",
            helper: "You can rename this later in Organization settings."
          },
          project: {
            section: "Project",
            sectionDescription: "Create the first product surface where feature flags and segments will live.",
            name: "Project name",
            key: "Project key",
            namePlaceholder: "Example project",
            keyPlaceholder: "example-project",
            helper: "Project key is generated from the project name and can be edited before setup."
          },
          environments: {
            section: "Default environments",
            sectionDescription: "FeatBit starts every project with a safe test environment and a production target.",
            helper: "Each environment gets its own SDK secret. Test in Dev before rolling out to Prod.",
            devDescription: "Use Dev for local integration, SDK checks, and safe internal testing.",
            prodDescription: "Use Prod for live rollout, targeting rules, and production traffic."
          },
          preview: {
            title: "What will be created",
            description: "FeatBit creates a project with Dev and Prod environments using separate SDK secrets.",
            organizationFallback: "Default Organization",
            projectFallback: "Example project",
            sdkSecret: "SDK secret",
            environments: "Environments",
            secrets: "SDK secrets"
          },
          checklist: {
            title: "After setup",
            organization: "Organization settings are available under Admin.",
            project: "Project and environments appear in the top context bar.",
            secrets: "SDK secrets are generated for Dev and Prod."
          },
          errors: {
            submit: "Operation failed, please try again"
          }
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
            globalUsers: "Global Users"
          },
          validation: {
            required: "This field is required",
            url: "Enter a valid URL",
            keyUsed: "This key has been used"
          },
          general: {
            accessConfiguration: "Access configuration",
            identity: {
              title: "Workspace identity",
              name: "Name",
              key: "Key",
              helper: "These settings identify your workspace and are used across FeatBit.",
              save: "Save changes",
              permissionNote: "You need workspace administrator permissions to update these settings."
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
              helper: "SSO settings are used to authenticate users via your identity provider.",
              save: "Save SSO settings",
              showSecret: "Show client secret",
              hideSecret: "Hide client secret",
              permissionNote: "Only workspace administrators can update SSO settings.",
              restrictedBadge: "Restricted",
              restrictedDescription: "You do not have permission to view or edit SSO settings."
            }
          },
          license: {
            workspaceId: "Workspace ID",
            workspaceIdHelper: "Required when generating a self-hosted license.",
            copy: "Copy",
            copyWorkspaceId: "Copy workspace ID",
            copied: "Copied",
            licenseKey: "License key",
            licenseKeyHelper: "Paste your new license key for self-hosted update.",
            licensePlaceholder: "Enter your license here",
            replace: "Replace",
            cancel: "Cancel",
            update: "Update license",
            updating: "Updating",
            updateSucceeded: "License updated!",
            invalidLicense: "Invalid license, please contact FeatBit team to get a license!",
            licenseStatus: "License status",
            currentPlan: "Current plan",
            source: "License source",
            saasSource: "SaaS",
            statusLabel: "Status",
            issuedAt: "Issued at",
            expires: "Expires",
            forever: "Forever",
            daysRemaining: "({{days}} days remaining)",
            syncDescription: "License details are synchronized with this workspace.",
            saasSyncDescription: "License details are synchronized with your subscription.",
            licensedFeatures: "Licensed features",
            granted: "Granted",
            notGranted: "Not granted",
            notIncluded: "Not included",
            noLicense: "No License Available",
            noLicenseDescription: "Please contact FeatBit team to get a license or generate a trial license from",
            status: {
              active: "Active",
              expired: "Expired",
              expiring: "Expiring soon",
              missing: "Unavailable"
            },
            features: {
              sso: {
                title: "Single sign-on",
                description: "Enable SSO via OIDC/SAML"
              },
              schedule: {
                title: "Schedule changes",
                description: "Schedule feature flag changes"
              },
              changeRequest: {
                title: "Change requests",
                description: "Review and approve flag changes"
              },
              multiOrganization: {
                title: "Multiple organizations",
                description: "Manage more than one organization"
              },
              globalUsers: {
                title: "Global users",
                description: "Manage users across the organization"
              },
              shareableSegment: {
                title: "Shareable segments",
                description: "Reuse segments across environments"
              },
              autoAgents: {
                title: "Auto agents",
                description: "Automate agent-driven operations"
              },
              fineGrainedAccessControl: {
                title: "Fine-grained access control",
                description: "Control access with detailed policies"
              },
              flagComparison: {
                title: "Flag comparison",
                description: "Compare flags across environments"
              }
            }
          }
        }
      }
    },
    zh: {
      common: {
        auth: {
          hero: {
            title: "放心发布",
            subtitle: "更安全、更规模化地交付更好的功能。"
          },
          login: {
            title: "登录到你的工作区",
            subtitle: "欢迎回来！请登录以继续。"
          },
          sso: {
            title: "使用 SSO 登录",
            subtitle: "输入你的 Workspace key 以继续"
          },
          email: "邮箱",
          password: "密码",
          passwordPlaceholder: "输入你的密码",
          remember: "记住我",
          forgot: "忘记密码？",
          signIn: "登录",
          continueWith: "或使用以下方式注册/登录",
          enterprise: "企业登录",
          ssoButton: "使用 SSO 登录",
          backToSignIn: "返回登录",
          workspaceKey: "Workspace key",
          continueSso: "继续使用 SSO",
          errors: {
            incorrectEmailOrPassword: "邮箱或密码错误",
            loginError: "发生错误，请联系技术支持。"
          }
        },
        layout: {
          nav: {
            groups: {
              getStarted: "开始使用",
              release: "发布",
              governance: "治理",
              experimentation: "实验",
              integrations: "集成",
              admin: "管理"
            },
            items: {
              getStarted: "开始使用",
              featureFlags: "开关管理",
              segments: "用户组",
              endUsers: "目标用户",
              auditLogs: "审计日志",
              changeRequests: "变更请求",
              experiments: "数据实验",
              metrics: "指标",
              relayProxies: "中继代理",
              webhooks: "WebHooks",
              accessTokens: "访问密钥",
              workspace: "工作区",
              organization: "组织机构",
              iam: "IAM",
              teams: "团队",
              groups: "组",
              policies: "策略"
            }
          },
          sidebar: {
            collapse: "收起侧边栏",
            expand: "展开侧边栏"
          },
          plan: {
            current: "当前订阅",
            free: "免费订阅",
            upgradeNow: "立即升级",
            expired: "许可证已过期",
            expiringSoon: "{{days}} 天后过期",
            getEnterprise: "获取企业版",
            aria: "{{label}}，{{plan}}"
          },
          context: {
            searchEnvironments: "搜索项目或环境",
            manageEnvironments: "管理环境"
          },
          environment: {
            production: "生产环境",
            staging: "预发布环境",
            development: "开发环境"
          },
          account: {
            account: "账号",
            profile: "个人信息",
            support: "技术支持",
            documentation: "文档",
            language: "语言",
            english: "English",
            chinese: "中文",
            theme: {
              label: "主题",
              light: "浅色",
              dark: "深色",
              system: "跟随系统"
            },
            version: "版本：{{version}}",
            signOut: "退出登录"
          },
          placeholder: "内容将在后续迁移步骤中添加。"
        },
        selectWorkspace: {
          workspace: {
            title: "选择工作区",
            subtitle: "{{email}} 的工作区",
            search: "搜索工作区",
            empty: "没有匹配的工作区。"
          },
          organization: {
            title: "选择组织机构",
            subtitle: "{{email}} 的组织机构",
            search: "搜索组织机构",
            empty: "没有匹配的组织机构。",
            noneTitle: "未找到组织机构",
            noneDescription: "你还没有任何组织机构。请联系管理员将你加入组织机构。"
          },
          backToWorkspaces: "返回工作区",
          signInWithAnotherEmail: "使用其他邮箱登录",
          errors: {
            loadWorkspaces: "加载工作区失败，请重试。",
            loadOrganizations: "加载组织机构失败，请重试。",
            joinOrganization: "发生错误，请重新登录。"
          }
        },
        onboarding: {
          eyebrow: "工作区初始化",
          title: "设置你的组织机构",
          subtitle: "创建第一个项目和环境，让团队开始使用功能开关发布。",
          formTitle: "配置发布上下文",
          formDescription: "这些值会成为顶层组织机构、第一个项目以及默认环境组合。",
          complete: "完成设置",
          signOut: "退出登录",
          stats: {
            organization: "组织机构",
            project: "项目 Key",
            environments: "环境"
          },
          organization: {
            section: "组织机构",
            sectionDescription: "命名用于管理项目、成员和治理配置的组织机构。",
            name: "组织机构名称",
            key: "组织机构 Key",
            placeholder: "Default Organization",
            helper: "之后可以在组织机构设置中重命名。"
          },
          project: {
            section: "项目",
            sectionDescription: "创建第一个承载功能开关和用户分组的产品项目。",
            name: "项目名称",
            key: "项目 Key",
            namePlaceholder: "Example project",
            keyPlaceholder: "example-project",
            helper: "项目 Key 会根据项目名称自动生成，完成设置前仍可编辑。"
          },
          environments: {
            section: "默认环境",
            sectionDescription: "FeatBit 会为每个项目创建测试环境和生产环境。",
            helper: "每个环境都有独立的 SDK secret。先在 Dev 中测试，再发布到 Prod。",
            devDescription: "Dev 用于本地集成、SDK 检查和安全的内部测试。",
            prodDescription: "Prod 用于线上发布、定向规则和生产流量。"
          },
          preview: {
            title: "将要创建",
            description: "FeatBit 会创建一个包含 Dev 和 Prod 环境的项目，并为每个环境生成独立 SDK secret。",
            organizationFallback: "Default Organization",
            projectFallback: "Example project",
            sdkSecret: "SDK secret",
            environments: "环境",
            secrets: "SDK secrets"
          },
          checklist: {
            title: "完成设置后",
            organization: "可以在管理区域中调整组织机构设置。",
            project: "项目和环境会出现在顶部上下文栏。",
            secrets: "系统会为 Dev 和 Prod 生成 SDK secret。"
          },
          errors: {
            submit: "操作失败，请重试"
          }
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
            globalUsers: "全局用户"
          },
          validation: {
            required: "此字段不能为空",
            url: "请输入有效 URL",
            keyUsed: "该 Key 已被使用"
          },
          general: {
            accessConfiguration: "访问配置",
            identity: {
              title: "工作区标识",
              name: "名称",
              key: "Key",
              helper: "这些设置用于标识工作区，并会在 FeatBit 中使用。",
              save: "保存更改",
              permissionNote: "需要工作区管理员权限才能更新这些设置。"
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
              helper: "SSO 设置用于通过你的身份提供商认证用户。",
              save: "保存 SSO 设置",
              showSecret: "显示 client secret",
              hideSecret: "隐藏 client secret",
              permissionNote: "只有工作区管理员可以更新 SSO 设置。",
              restrictedBadge: "受限",
              restrictedDescription: "你没有权限查看或编辑 SSO 设置。"
            }
          },
          license: {
            workspaceId: "Workspace ID",
            workspaceIdHelper: "生成自托管许可证时需要提供此 ID。",
            copy: "复制",
            copyWorkspaceId: "复制 Workspace ID",
            copied: "已复制",
            licenseKey: "许可证 Key",
            licenseKeyHelper: "粘贴新的许可证 Key 以更新自托管授权。",
            licensePlaceholder: "在此输入许可证",
            replace: "替换",
            cancel: "取消",
            update: "更新许可证",
            updating: "更新中",
            updateSucceeded: "许可证已更新！",
            invalidLicense: "许可证无效，请联系 FeatBit 团队获取许可证！",
            licenseStatus: "许可证状态",
            currentPlan: "当前套餐",
            source: "许可证来源",
            saasSource: "SaaS",
            statusLabel: "状态",
            issuedAt: "签发时间",
            expires: "过期时间",
            forever: "永久",
            daysRemaining: "（剩余 {{days}} 天）",
            syncDescription: "许可证详情已同步到此工作区。",
            saasSyncDescription: "许可证详情已与你的订阅同步。",
            licensedFeatures: "授权功能",
            granted: "已授权",
            notGranted: "未授权",
            notIncluded: "未包含",
            noLicense: "暂无可用许可证",
            noLicenseDescription: "请联系 FeatBit 团队获取许可证，或从这里生成试用许可证：",
            status: {
              active: "有效",
              expired: "已过期",
              expiring: "即将过期",
              missing: "不可用"
            },
            features: {
              sso: {
                title: "单点登录",
                description: "通过 OIDC/SAML 启用 SSO"
              },
              schedule: {
                title: "定时变更",
                description: "定时执行功能开关变更"
              },
              changeRequest: {
                title: "变更请求",
                description: "审核并批准开关变更"
              },
              multiOrganization: {
                title: "多组织",
                description: "管理多个组织机构"
              },
              globalUsers: {
                title: "全局用户",
                description: "跨组织管理用户"
              },
              shareableSegment: {
                title: "共享用户分组",
                description: "跨环境复用用户分组"
              },
              autoAgents: {
                title: "自动代理",
                description: "自动化代理相关操作"
              },
              fineGrainedAccessControl: {
                title: "细粒度访问控制",
                description: "通过细粒度策略控制访问"
              },
              flagComparison: {
                title: "开关对比",
                description: "跨环境对比功能开关"
              }
            }
          }
        }
      }
    }
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false
  }
});

export { i18n };
