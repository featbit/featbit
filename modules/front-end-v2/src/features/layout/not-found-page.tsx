import { FileSearch, Home } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"

export function NotFoundPage() {
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-10">
      <section className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-sm">
          <FileSearch className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-8 text-6xl font-semibold tracking-normal text-foreground">
          {t("layout.notFound.code")}
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal text-foreground">
          {t("layout.notFound.title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:whitespace-nowrap">
          {t("layout.notFound.description")}
        </p>
        <Link
          className={buttonVariants({ className: "mt-7" })}
          to={localizedPath(lang, "")}
        >
          <Home className="size-4" aria-hidden="true" />
          {t("layout.notFound.goHome")}
        </Link>
      </section>
    </div>
  )
}
