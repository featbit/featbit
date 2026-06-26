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


