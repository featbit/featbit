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
