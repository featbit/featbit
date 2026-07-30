import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSdkDefinition } from "../sdk-definitions"
import type {
  GetStartedFlag,
  GetStartedStep,
  SdkId,
} from "../get-started-types"

const STEPS = [
  "Create a feature flag",
  "Connect an SDK",
  "Verify connection",
] as const

export function GetStartedProgress({
  step,
  flag,
  sdkId,
}: {
  step: GetStartedStep
  flag: GetStartedFlag | null
  sdkId: SdkId
}) {
  const sdk = getSdkDefinition(sdkId)

  return (
    <ol className="grid min-h-17 grid-cols-3 overflow-hidden rounded-lg border bg-card">
      {STEPS.map((label, index) => {
        const completed = index < step
        const active = index === step
        const supporting =
          completed && index === 0
            ? flag?.key
            : completed && index === 1
              ? sdk.label
              : ""

        return (
          <li
            key={label}
            className="flex min-w-0 items-center gap-3 px-5 py-3 lg:px-6"
            aria-current={active ? "step" : undefined}
          >
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
          </li>
        )
      })}
    </ol>
  )
}
