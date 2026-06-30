import { Navigate, useParams } from "react-router-dom";
import { localizedPath, resolveLang } from "@/features/layout/context";
import { GeneralPage } from "./general/general-page";
import { GlobalUsersPage } from "./global-users/global-users-page";
import { LicensePage } from "./license/license-page";

export function WorkspacePage({ activeTab = "general" }: { activeTab?: string }) {
  const params = useParams();
  const lang = resolveLang(params.lang);

  if (activeTab === "license") {
    return <LicensePage lang={lang} />;
  }

  if (activeTab === "global-users") {
    return <GlobalUsersPage lang={lang} />;
  }

  if (activeTab !== "general") {
    return <Navigate to={localizedPath(lang, "/workspace")} replace />;
  }

  return <GeneralPage lang={lang} />;
}
