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
          continueWith: "or continue with",
          enterprise: "Enterprise sign-in",
          ssoButton: "Sign in with SSO",
          backToSignIn: "Back to sign in",
          workspaceKey: "Workspace key",
          continueSso: "Continue with SSO",
          errors: {
            incorrectEmailOrPassword: "Email and/or password incorrect",
            loginError: "Error occurred, please contact the support."
          }
        }
      }
    },
    zh: {
      common: {
        auth: {
          hero: {
            title: "安心发布",
            subtitle: "更安全、更规模化地交付更好的功能。"
          },
          login: {
            title: "登录到你的工作区",
            subtitle: "欢迎回来！请登录以继续。"
          },
          sso: {
            title: "使用 SSO 登录",
            subtitle: "输入你的工作区 key 以继续"
          },
          email: "邮箱",
          password: "密码",
          passwordPlaceholder: "输入你的密码",
          remember: "记住我",
          forgot: "忘记密码？",
          signIn: "登录",
          continueWith: "或继续使用",
          enterprise: "企业登录",
          ssoButton: "使用 SSO 登录",
          backToSignIn: "返回登录",
          workspaceKey: "工作区 key",
          continueSso: "继续使用 SSO",
          errors: {
            incorrectEmailOrPassword: "邮箱或密码错误",
            loginError: "发生错误，请联系支持人员。"
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
