import { ArrowLeft, Building2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getSsoAuthorizeUrl,
  type SsoPreCheck
} from "@/features/auth/auth-api";
import type { Lang } from "@/features/auth/auth-page-types";
import { Field } from "@/features/auth/form-controls";

export function SsoForm({ lang, preCheck }: { lang: Lang; preCheck: SsoPreCheck | null }) {
  const { t } = useTranslation();
  const [workspaceKey, setWorkspaceKey] = useState(preCheck?.workspaceKey ?? "");
  const [error, setError] = useState("");

  function handleSsoSubmit() {
    setError("");

    const trimmedWorkspaceKey = workspaceKey.trim();
    if (!trimmedWorkspaceKey) {
      setError("Workspace key is required");
      return;
    }

    window.location.href = getSsoAuthorizeUrl(trimmedWorkspaceKey);
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col justify-start px-8 pb-8 sm:px-12 lg:px-0">
      <Button asChild variant="link" className="mb-14 h-auto justify-start gap-3 p-0 text-base">
        <Link to={`/${lang}/login`}>
          <ArrowLeft className="h-5 w-5" />
          {t("auth.backToSignIn")}
        </Link>
      </Button>

      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("auth.sso.title")}</h2>
        <p className="mt-3 text-base text-muted-foreground">{t("auth.sso.subtitle")}</p>
      </div>

      <form
        className="mt-14 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          handleSsoSubmit();
        }}
      >
        <Field
          label={t("auth.workspaceKey")}
          placeholder="acme-prod"
          icon={<Building2 className="h-6 w-6" />}
          value={workspaceKey}
          disabled={Boolean(preCheck?.workspaceKey)}
          autoComplete="organization"
          name="workspaceKey"
          required
          onChange={(event) => setWorkspaceKey(event.target.value)}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button className="h-14 w-full gap-3 text-lg" type="submit">
          <Building2 className="h-6 w-6" />
          {t("auth.continueSso")}
        </Button>
      </form>
    </div>
  );
}
