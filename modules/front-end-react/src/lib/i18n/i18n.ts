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
            noEnvironments: "No environments found.",
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
              restrictedDescription: "You do not have permission to view or edit SSO settings.",
              unlicensedBadge: "License required",
              unlicensedDescription: "Single sign-on is a paid feature. Add a license that includes SSO to enable it for this workspace."
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
            licensedFeatures: "Licensed features",
            granted: "Granted",
            notGranted: "Not granted",
            notIncluded: "Not included",
            noLicense: "No License Available",
            noLicenseDescription: "Please contact FeatBit team to get a license or generate a trial license from",
            noLicenseSaasDescription: "Subscribe from the Billing page to activate license features for this workspace.",
            openBilling: "Open Billing",
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
          },
          billing: {
            errors: {
              subscriptionTitle: "Failed to load subscription",
              subscriptionDescription: "Subscription details are temporarily unavailable. You can still review billing information and invoices below.",
              billingInfoLoad: "Failed to load billing information.",
              invoicesLoad: "Failed to load invoices.",
              saveBillingInfo: "Failed to update billing information. Please try again.",
              subscriptionUpdate: "Failed to update subscription. Please try again.",
              proration: "Unable to load proration preview. You will see the exact charge at checkout."
            },
            actions: {
              retry: "Retry",
              checkAgain: "Check again",
              returnToBilling: "Return to billing",
              contactSupport: "Contact support",
              upgradePlan: "Upgrade plan",
              manageSubscription: "Manage subscription",
              edit: "Edit",
              cancel: "Cancel",
              saveChanges: "Save changes",
              maybeLater: "Maybe later",
              confirmUpgrade: "Confirm upgrade",
              scheduleDowngrade: "Schedule downgrade",
              updatePlan: "Update plan",
              currentPlan: "Current plan",
              upgradeTo: "Upgrade to {{plan}}",
              downgradeTo: "Downgrade to {{plan}}"
            },
            checkout: {
              confirmed: "Payment confirmed. Your subscription is active.",
              timeoutTitle: "Payment verification is taking longer than expected.",
              cancelled: "Payment cancelled. Your subscription was not changed.",
              verifying: "Verifying payment..."
            },
            usageAlert: {
              approaching: "Approaching usage limit",
              exceeded: "MAU limit exceeded",
              usedBadge: "{{percent}}% used",
              description: "You've used {{used}} of {{purchased}} MAU in your current billing period. You may experience limits or overage charges."
            },
            overview: {
              monthlyBilling: "Monthly billing",
              yearlyBilling: "Yearly billing",
              scheduledDowngrade: "You have a pending downgrade to {{plan}} at the end of the current billing period.",
              billingPeriod: "Billing period",
              nextCharge: "Next charge",
              subscriberSince: "Subscriber since",
              currentUsage: "Current usage",
              mau: "Monthly Active Users (MAU)",
              usedOf: "{{used}} of {{purchased}} used",
              remaining: "{{remaining}} remaining",
              criticalHeadroom: "Critical headroom",
              watchUsage: "Watch usage closely",
              healthyHeadroom: "Healthy headroom",
              healthy: "Usage is healthy",
              feeBreakdown: "Fee breakdown",
              planFee: "{{plan}} plan",
              fineGrained: "Fine-grained Access Control",
              totalCharge: "Total charge",
              perMonth: "{{amount}}/month",
              plusPerMonth: "+ {{amount}}/month"
            },
            billingInfo: {
              title: "Billing information",
              description: "Used for workspace invoices and billing emails.",
              editDescription: "Update invoice recipient, address, and tax details.",
              companyName: "Company name",
              contactEmail: "Contact email",
              address: "Address",
              addressLine2: "Address line 2",
              taxId: "Tax ID",
              countryRegion: "Country / Region",
              notProvided: "Not provided",
              updated: "Billing information updated."
            },
            invoices: {
              title: "Invoice history",
              description: "Recent invoices for this workspace.",
              questions: "Questions about billing?",
              billingDate: "Billing date",
              plan: "Plan",
              status: "Status",
              amount: "Amount",
              empty: "No invoices yet",
              paid: "Paid",
              pending: "Pending",
              overdue: "Overdue",
              unknown: "Unknown"
            },
            drawer: {
              manageTitle: "Manage subscription",
              manageDescription: "Review plans, MAU capacity, add-ons, and billing cycle for this workspace.",
              upgradeTitle: "Upgrade plan",
              upgradeDescription: "Increase capacity before this billing cycle reaches its MAU limit.",
              approachingLimit: "Approaching MAU limit",
              currentCapacity: "{{used}} of {{purchased}} MAU used - {{percent}}% of current capacity.",
              currentPlanSummary: "Current plan",
              mauCapacity: "MAU capacity",
              currentTotal: "Current total",
              recommended: "Recommended for scale",
              fastestFix: "Fastest fix",
              addCapacity: "Add capacity to {{plan}}",
              addCapacityDescription: "Keep your current plan and increase MAU for the next invoice.",
              selectedMau: "Selected MAU",
              includedMau: "{{mau}} MAU included",
              mauPlain: "{{mau}} MAU",
              communitySupport: "Community support",
              prioritySupport: "Priority support",
              fineGrainedAccess: "Fine-grained access",
              moreFeatures: "More features",
              upgradeEnterprise: "Upgrade to Enterprise",
              enterpriseDescription: "Move to higher included MAU and unlock enterprise controls.",
              startingCapacity: "Starting capacity",
              upTo: "up to {{mau}}",
              enterpriseMonthly: "Enterprise monthly",
              enterpriseYearly: "$4,490/year",
              enterpriseFeatures: "SSO + Global Users",
              yearlyOption: "Yearly option",
              includedFeatures: "Included features",
              support: "Support",
              dedicatedSla: "Dedicated SLA",
              enterpriseSummary: "80K MAU included - annual billing available - SSO - Global Users",
              dedicatedOnboarding: "Dedicated SLA and onboarding",
              advancedGovernance: "Multi-organization and advanced governance",
              monthly: "Monthly",
              yearly: "Yearly",
              growthBase: "Growth base",
              extendedMau: "Extended MAU",
              projectedTotal: "Projected total"
            },
            dialog: {
              upgradeTitle: "Upgrade subscription",
              downgradeTitle: "Downgrade subscription",
              upgradeDescription: "Your plan configuration is changing",
              downgradeDescription: "Current access remains until renewal.",
              newRecurringTotal: "New recurring total",
              currentRecurringTotal: "Current recurring total",
              selectedMau: "Selected MAU",
              included: "Included",
              calculating: "Calculating your prorated charge...",
              credit: "Credit",
              charge: "Charge",
              totalDueToday: "Total due today"
            },
            validation: {
              companyName: "Company name is required",
              contactEmail: "Contact email is required",
              email: "Enter a valid email",
              address: "Address is required",
              countryRegion: "Country / Region is required"
            },
            toast: {
              subscriptionUpdated: "Subscription updated successfully."
            },
            plans: {
              free: {
                name: "Free",
                description: "Core feature flags at no cost."
              },
              pro: {
                name: "Pro",
                description: "For growing teams that need scale."
              },
              growth: {
                name: "Growth",
                description: "Advanced controls for scaling product teams."
              },
              enterprise: {
                name: "Enterprise",
                description: "Full platform features for large organizations."
              }
            }
          },
          globalUsers: {
            searchByName: "Search by name",
            display: "Display",
            searchColumns: "Search columns",
            noColumnsFound: "No columns found",
            clearAll: "Clear all",
            importAction: "Import",
            importUsers: "Import users",
            name: "Name",
            actions: "Actions",
            evaluateAction: "Evaluate",
            detailsAction: "Details",
            unnamedUser: "Unnamed user",
            failedToLoad: "Failed to load data",
            retry: "Retry",
            loading: "Loading",
            empty: "No global users yet",
            emptySearch: "No users match your search",
            clearSearch: "Clear search",
            copied: "Copied",
            pagination: {
              summary: "Showing {{first}} to {{last}} of {{total}} users",
              pageSize: "{{size}} / page"
            },
            gated: {
              title: "Global Users is not enabled",
              body: "Enable the Global Users feature in your license to manage workspace-level users.",
              action: "Open License",
              tooltip: "Global Users is not enabled by your license."
            },
            import: {
              title: "Import users",
              intro: "Choose a JSON data file to create or update global users.",
              viewTemplate: "View template",
              noteKey: "Users are created or updated by keyId.",
              noteProperties: "New user properties are added without removing existing properties.",
              drop: "Drop JSON file here or click to browse",
              constraints: "Supported format: JSON. Maximum file size: 500 MB.",
              invalidType: "Only JSON files can be imported.",
              tooLarge: "File size must be 500 MB or less.",
              success: "User data has been successfully imported.",
              error: "Failed to import user data. Please check the file and try again.",
              cancel: "Cancel"
            },
            evaluate: {
              flags: "Feature Flags",
              segments: "Segments",
              filterFlags: "Filter by name or key",
              filterSegments: "Filter by name",
              variation: "Variation",
              type: "Type",
              lastUpdated: "Last updated"
            },
            details: {
              title: "User profile",
              builtIn: "Built-in properties",
              custom: "Custom properties",
              noCustomProperties: "No custom properties"
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
            noEnvironments: "未找到环境。",
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
              restrictedDescription: "你没有权限查看或编辑 SSO 设置。",
              unlicensedBadge: "需要许可证",
              unlicensedDescription: "单点登录是付费功能。请添加包含 SSO 的许可证以为此工作区启用该功能。"
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
            licensedFeatures: "授权功能",
            granted: "已授权",
            notGranted: "未授权",
            notIncluded: "未包含",
            noLicense: "暂无可用许可证",
            noLicenseDescription: "请联系 FeatBit 团队获取许可证，或从这里生成试用许可证：",
            noLicenseSaasDescription: "请在账单页面订阅，以为当前工作区启用授权功能。",
            openBilling: "打开账单",
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
          },
          billing: {
            errors: {
              subscriptionTitle: "加载订阅失败",
              subscriptionDescription: "订阅详情暂时不可用。你仍可以查看下方的账单信息和发票。",
              billingInfoLoad: "加载账单信息失败。",
              invoicesLoad: "加载发票失败。",
              saveBillingInfo: "更新账单信息失败，请稍后重试。",
              subscriptionUpdate: "更新订阅失败，请稍后重试。",
              proration: "无法加载按比例计费预览。你将在结账时看到准确费用。"
            },
            actions: {
              retry: "重试",
              checkAgain: "重新检查",
              returnToBilling: "返回账单",
              contactSupport: "联系支持",
              upgradePlan: "升级套餐",
              manageSubscription: "管理订阅",
              edit: "编辑",
              cancel: "取消",
              saveChanges: "保存更改",
              maybeLater: "稍后再说",
              confirmUpgrade: "确认升级",
              scheduleDowngrade: "安排降级",
              updatePlan: "更新套餐",
              currentPlan: "当前套餐",
              upgradeTo: "升级到 {{plan}}",
              downgradeTo: "降级到 {{plan}}"
            },
            checkout: {
              confirmed: "付款已确认。你的订阅已生效。",
              timeoutTitle: "付款验证耗时比预期更长。",
              cancelled: "付款已取消。你的订阅未发生变化。",
              verifying: "正在验证付款..."
            },
            usageAlert: {
              approaching: "即将达到用量上限",
              exceeded: "MAU 上限已超出",
              usedBadge: "已用 {{percent}}%",
              description: "当前账单周期已使用 {{used}} / {{purchased}} MAU。你可能会遇到限制或超额费用。"
            },
            overview: {
              monthlyBilling: "按月计费",
              yearlyBilling: "按年计费",
              scheduledDowngrade: "你有一个待生效的降级，当前账单周期结束后将变更为 {{plan}}。",
              billingPeriod: "账单周期",
              nextCharge: "下次扣费",
              subscriberSince: "订阅开始时间",
              currentUsage: "当前用量",
              mau: "月活跃用户（MAU）",
              usedOf: "已用 {{used}} / {{purchased}}",
              remaining: "剩余 {{remaining}}",
              criticalHeadroom: "容量余量严重不足",
              watchUsage: "请密切关注用量",
              healthyHeadroom: "容量余量健康",
              healthy: "余量充足",
              feeBreakdown: "费用明细",
              planFee: "{{plan}} 套餐",
              fineGrained: "细粒度访问控制",
              totalCharge: "总费用",
              perMonth: "{{amount}}/月",
              plusPerMonth: "+ {{amount}}/月"
            },
            billingInfo: {
              title: "账单信息",
              description: "用于工作区发票和账单邮件。",
              editDescription: "更新发票接收方、地址和税务信息。",
              companyName: "公司名称",
              contactEmail: "联系邮箱",
              address: "地址",
              addressLine2: "地址第二行",
              taxId: "税号",
              countryRegion: "国家 / 地区",
              notProvided: "未提供",
              updated: "账单信息已更新。"
            },
            invoices: {
              title: "发票历史",
              description: "当前工作区最近的发票。",
              questions: "对账单有疑问？",
              billingDate: "账单日期",
              plan: "套餐",
              status: "状态",
              amount: "金额",
              empty: "暂无发票",
              paid: "已支付",
              pending: "待支付",
              overdue: "已逾期",
              unknown: "未知"
            },
            drawer: {
              manageTitle: "管理订阅",
              manageDescription: "查看并调整当前工作区的套餐、MAU 容量、附加功能和计费周期。",
              upgradeTitle: "升级套餐",
              upgradeDescription: "在当前账单周期达到 MAU 上限前提升容量。",
              approachingLimit: "即将达到 MAU 上限",
              currentCapacity: "已使用 {{used}} / {{purchased}} MAU，占当前容量 {{percent}}%。",
              currentPlanSummary: "当前套餐",
              mauCapacity: "MAU 容量",
              currentTotal: "当前总计",
              recommended: "推荐用于规模化",
              fastestFix: "最快解决",
              addCapacity: "为 {{plan}} 增加容量",
              addCapacityDescription: "保留当前套餐，并为下个账单增加 MAU。",
              selectedMau: "已选 MAU",
              includedMau: "包含 {{mau}} MAU",
              mauPlain: "{{mau}} MAU",
              communitySupport: "社区支持",
              prioritySupport: "优先支持",
              fineGrainedAccess: "细粒度访问",
              moreFeatures: "更多功能",
              upgradeEnterprise: "升级到 Enterprise",
              enterpriseDescription: "提升内置 MAU，并解锁企业级控制能力。",
              startingCapacity: "起始容量",
              upTo: "最高 {{mau}}",
              enterpriseMonthly: "Enterprise 月付",
              enterpriseYearly: "$4,490/年",
              enterpriseFeatures: "SSO + 全局用户",
              yearlyOption: "年付选项",
              includedFeatures: "包含功能",
              support: "支持",
              dedicatedSla: "专属 SLA",
              enterpriseSummary: "包含 80K MAU - 支持年付 - SSO - 全局用户",
              dedicatedOnboarding: "专属 SLA 和引导服务",
              advancedGovernance: "多组织和高级治理",
              monthly: "月付",
              yearly: "年付",
              growthBase: "Growth 基础费用",
              extendedMau: "扩展 MAU",
              projectedTotal: "预计总计"
            },
            dialog: {
              upgradeTitle: "升级订阅",
              downgradeTitle: "降级订阅",
              upgradeDescription: "你的套餐配置将发生变化",
              downgradeDescription: "当前权限将保留到续订日。",
              newRecurringTotal: "新的周期费用",
              currentRecurringTotal: "当前周期费用",
              selectedMau: "已选 MAU",
              included: "已包含",
              calculating: "正在计算按比例费用...",
              credit: "抵扣",
              charge: "收费",
              totalDueToday: "今日应付"
            },
            validation: {
              companyName: "公司名称不能为空",
              contactEmail: "联系邮箱不能为空",
              email: "请输入有效邮箱",
              address: "地址不能为空",
              countryRegion: "国家 / 地区不能为空"
            },
            toast: {
              subscriptionUpdated: "订阅已更新。"
            },
            plans: {
              free: {
                name: "Free",
                description: "免费使用核心功能开关能力。"
              },
              pro: {
                name: "Pro",
                description: "适合需要扩展规模的成长团队。"
              },
              growth: {
                name: "Growth",
                description: "为规模化产品团队提供高级控制能力。"
              },
              enterprise: {
                name: "Enterprise",
                description: "面向大型组织的完整平台能力。"
              }
            }
          },
          globalUsers: {
            searchByName: "按名称搜索",
            display: "显示列",
            searchColumns: "搜索列",
            noColumnsFound: "未找到列",
            clearAll: "全部清除",
            importAction: "导入",
            importUsers: "导入用户",
            name: "名称",
            actions: "操作",
            evaluateAction: "评估",
            detailsAction: "详情",
            unnamedUser: "未命名用户",
            failedToLoad: "加载数据失败",
            retry: "重试",
            loading: "加载中",
            empty: "暂无全局用户",
            emptySearch: "没有匹配的用户",
            clearSearch: "清除搜索",
            copied: "已复制",
            pagination: {
              summary: "显示第 {{first}} 到 {{last}} 条，共 {{total}} 个用户",
              pageSize: "{{size}} / 页"
            },
            gated: {
              title: "全局用户未启用",
              body: "请在许可证中启用全局用户功能，以管理工作区级用户。",
              action: "打开许可证",
              tooltip: "当前许可证未启用全局用户。"
            },
            import: {
              title: "导入用户",
              intro: "选择 JSON 数据文件来创建或更新全局用户。",
              viewTemplate: "查看模板",
              noteKey: "用户会根据 keyId 创建或更新。",
              noteProperties: "新的用户属性会被添加，不会删除已有属性。",
              drop: "拖拽 JSON 文件到此处，或点击选择",
              constraints: "支持格式：JSON。最大文件大小：500 MB。",
              invalidType: "只能导入 JSON 文件。",
              tooLarge: "文件大小不能超过 500 MB。",
              success: "用户数据已成功导入。",
              error: "导入用户数据失败，请检查文件后重试。",
              cancel: "取消"
            },
            evaluate: {
              flags: "功能开关",
              segments: "用户分组",
              filterFlags: "按名称或 Key 过滤",
              filterSegments: "按名称过滤",
              variation: "返回值",
              type: "类型",
              lastUpdated: "最后更新"
            },
            details: {
              title: "用户资料",
              builtIn: "内置属性",
              custom: "自定义属性",
              noCustomProperties: "暂无自定义属性"
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
