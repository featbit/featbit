import { useTranslation } from "react-i18next"

export function useDocumentationCopy() {
  return useTranslation("common", { keyPrefix: "flagDocumentation" })
}
