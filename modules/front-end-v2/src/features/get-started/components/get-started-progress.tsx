import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { getSdkDefinition } from "../sdk-definitions"
import type {
  GetStartedFlag,
  GetStartedStep,
  SdkId,
} from "../get-started-types"

const STEP_KEYS = ["createFlag", "connectSdk", "verifyConnection"] as const

export function GetStartedProgress({
  step,
  flag,
  sdkId,
  onStepChange,
}: {
  step: GetStartedStep
  flag: GetStartedFlag | null
  sdkId: SdkId
  onStepChange: (step: GetStartedStep) => void
}) {
  const { t } = useTranslation()
  const sdk = getSdkDefinition(sdkId)

  return (
    <ol className="grid min-h-17 grid-cols-3 overflow-hidden rounded-lg border bg-card">
      {STEP_KEYS.map((stepKey, index) => {
        const label = t(`getStarted.steps.${stepKey}`)
        const completed = index < step
        const active = index === step
        const itemClassName =
          "flex h-full min-h-17 min-w-0 items-center gap-3 px-5 py-3 text-left lg:px-6"
        const supporting =
          completed && index === 0
            ? flag?.key
            : completed && index === 1
              ? sdk.label
              : ""

        const content = (
          <>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                active && "border-primary bg-primary text-primary-foreground",
                completed &&
                  "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500",
                !active &&
                  !completed &&
                  "border-border bg-background text-foreground"
              )}
            >
              {completed ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {label}
              </span>
              {supporting ? (
                <code className="block truncate text-xs text-muted-foreground">
                  {supporting}
                </code>
              ) : null}
            </span>
          </>
        )

        return (
          <li
            key={stepKey}
            className="min-w-0"
            aria-current={active ? "step" : undefined}
          >
            {completed ? (
              <button
                type="button"
                className={cn(
                  itemClassName,
                  "w-full rounded-md transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                )}
                onClick={() => onStepChange(index as GetStartedStep)}
              >
                {content}
              </button>
            ) : (
              <div className={itemClassName}>{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
