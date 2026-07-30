import { useTranslation } from "react-i18next"

export function AuthFooter() {
  const { t } = useTranslation()

  return (
    <footer className="flex items-center justify-center gap-6 py-6 text-sm text-muted-foreground sm:gap-7 sm:py-8">
      <a
        href="https://www.featbit.co/privacy"
        target="_blank"
        rel="noreferrer noopener"
        className="transition-colors hover:text-foreground"
      >
        {t("auth.footer.privacy")}
      </a>
      <span aria-hidden="true">&bull;</span>
      <a
        href="https://docs.featbit.co"
        target="_blank"
        rel="noreferrer noopener"
        className="transition-colors hover:text-foreground"
      >
        {t("auth.footer.help")}
      </a>
    </footer>
  )
}
