import { Navigate, useParams } from "react-router-dom";
import { localizedPath, resolveLang } from "@/features/layout/context";
import { GeneralPage } from "./general/general-page";

export function WorkspacePage({ activeTab = "general" }: { activeTab?: string }) {
  const params = useParams();
  const lang = resolveLang(params.lang);

  if (activeTab !== "general") {
    return <Navigate to={localizedPath(lang, "/workspace")} replace />;
  }

  return <GeneralPage lang={lang} />;
}
