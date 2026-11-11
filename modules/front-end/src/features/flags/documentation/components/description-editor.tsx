import { Fragment, useRef, useState, type ReactNode } from "react"
import { Bold, Code, Heading2, Italic, Link2, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useDocumentationCopy } from "../use-documentation-copy"

function inlineText(text: string): ReactNode[] {
  return text
    .split(
      /(\*\*[^*\n]+\*\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g
    )
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>
      if (part.startsWith("_") && part.endsWith("_"))
        return <em key={index}>{part.slice(1, -1)}</em>
      if (part.startsWith("`") && part.endsWith("`"))
        return (
          <code key={index} className="rounded bg-muted px-1 py-0.5 text-xs">
            {part.slice(1, -1)}
          </code>
        )
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part)
      if (link)
        return (
          <a
            key={index}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {link[1]}
          </a>
        )
      return <Fragment key={index}>{part}</Fragment>
    })
}

// Render a small, explicit Markdown subset as React nodes. Raw HTML stays text.
export function DescriptionContent({ value }: { value: string }) {
  const blocks: ReactNode[] = []
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index++
      continue
    }
    if (/^#{1,3} /.test(line)) {
      blocks.push(
        <h3 key={index} className="pt-1 text-sm font-semibold">
          {inlineText(line.replace(/^#{1,3} /, ""))}
        </h3>
      )
      index++
    } else if (/^[-*] /.test(line)) {
      const items: ReactNode[] = []
      const start = index
      while (index < lines.length && /^[-*] /.test(lines[index])) {
        items.push(<li key={index}>{inlineText(lines[index].slice(2))}</li>)
        index++
      }
      blocks.push(
        <ul key={start} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      )
    } else {
      const paragraph = [line]
      const start = index++
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,3}|[-*]) /.test(lines[index])
      )
        paragraph.push(lines[index++])
      blocks.push(
        <p key={start} className="whitespace-pre-wrap">
          {inlineText(paragraph.join("\n"))}
        </p>
      )
    }
  }
  return <div className="space-y-3 text-sm leading-6 break-words">{blocks}</div>
}

export function DescriptionEditor({
  value,
  onChange,
  invalid,
  id = "doc-description",
  disabled = false,
  initialMode = "write",
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  id?: string
  disabled?: boolean
  initialMode?: "write" | "preview"
  compact?: boolean
}) {
  const { t } = useDocumentationCopy()
  const [preview, setPreview] = useState(initialMode === "preview")
  const ref = useRef<HTMLTextAreaElement>(null)
  function format(prefix: string, suffix = "", placeholder = "text") {
    const input = ref.current
    if (!input || disabled) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = value.slice(start, end) || placeholder
    onChange(
      value.slice(0, start) + prefix + selected + suffix + value.slice(end)
    )
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      )
    })
  }
  const tools: {
    icon: typeof Bold
    label: string
    prefix: string
    suffix?: string
    placeholder?: string
  }[] = [
    { icon: Bold, label: t("bold"), prefix: "**", suffix: "**" },
    { icon: Italic, label: t("italic"), prefix: "_", suffix: "_" },
    { icon: Heading2, label: t("heading"), prefix: "\n## " },
    { icon: List, label: t("bulletList"), prefix: "\n- " },
    { icon: Code, label: t("code"), prefix: "`", suffix: "`" },
    {
      icon: Link2,
      label: t("link"),
      prefix: "[",
      suffix: "](https://example.com)",
      placeholder: "link text",
    },
  ]
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        invalid && "border-destructive"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 p-1.5">
        <div className="flex gap-0.5">
          {tools.map(({ icon: Icon, label, prefix, suffix, placeholder }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={label}
              aria-label={label}
              disabled={preview || disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => format(prefix, suffix, placeholder)}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={preview ? "ghost" : "secondary"}
            onClick={() => setPreview(false)}
          >
            {t(compact ? "edit" : "write")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preview ? "secondary" : "ghost"}
            onClick={() => setPreview(true)}
          >
            {t("preview")}
          </Button>
        </div>
      </div>
      {preview ? (
        <div
          id={id}
          tabIndex={0}
          className={cn("p-4", compact ? "min-h-24" : "min-h-64")}
        >
          {value.trim() ? (
            <DescriptionContent value={value} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("nothingToPreview")}
            </p>
          )}
        </div>
      ) : (
        <Textarea
          ref={ref}
          id={id}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          placeholder={t("descriptionPlaceholder")}
          className={cn(
            "resize-y rounded-none border-0 p-4 font-mono text-xs leading-6 focus-visible:ring-0",
            compact ? "min-h-32" : "min-h-64"
          )}
        />
      )}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        {t("formattingHelp")}
      </div>
    </div>
  )
}
