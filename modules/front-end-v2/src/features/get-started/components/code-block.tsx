import { useEffect, useState, type CSSProperties } from "react"
import { highlightCode, type HighlightedCode } from "../syntax-highlighter"
import { CopyButton } from "./copy-button"

type SyntaxTokenStyle = CSSProperties & {
  "--syntax-light": string
  "--syntax-dark": string
}

export function CodeBlock({
  code,
  copyValue = code,
  language,
  highlight = false,
  lineNumbers = false,
  maxHeightClassName = "max-h-64",
}: {
  code: string
  copyValue?: string
  language: string
  highlight?: boolean
  lineNumbers?: boolean
  maxHeightClassName?: string
}) {
  const source = code.trim()
  const lines = source.split("\n")
  const highlightKey = highlight ? `${language}:${source}` : ""
  const [highlighted, setHighlighted] = useState<{
    key: string
    lines: HighlightedCode | null
  } | null>(null)

  useEffect(() => {
    if (!highlight) return

    let cancelled = false
    void highlightCode(source, language)
      .then((nextLines) => {
        if (!cancelled) {
          setHighlighted({ key: highlightKey, lines: nextLines })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlighted({ key: highlightKey, lines: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [highlight, highlightKey, language, source])

  const highlightingSettled = highlighted?.key === highlightKey
  const highlightedLines = highlightingSettled ? highlighted.lines : null

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex h-8 items-center justify-between border-b bg-muted/30 px-3 text-xs text-muted-foreground">
        <span>{language}</span>
        <CopyButton
          value={copyValue.trim()}
          label={`Copy ${language} code`}
          iconOnly
        />
      </div>
      <pre
        className={`${maxHeightClassName} overflow-auto px-3 py-2.5 font-mono text-xs leading-5 text-foreground`}
        aria-busy={highlight && !highlightingSettled}
      >
        <code>
          {lines.map((line, index) => (
            <span
              key={`${index}-${line}`}
              className={lineNumbers ? "grid grid-cols-[2rem_1fr]" : "block"}
            >
              {lineNumbers ? (
                <span className="pr-3 text-right text-muted-foreground/70 select-none">
                  {index + 1}
                </span>
              ) : null}
              <span>
                {highlightedLines?.[index]?.length
                  ? highlightedLines[index].map((token, tokenIndex) => (
                      <span
                        key={`${tokenIndex}-${token.content}`}
                        className="text-[var(--syntax-light)] dark:text-[var(--syntax-dark)]"
                        style={
                          {
                            "--syntax-light": token.lightColor,
                            "--syntax-dark": token.darkColor,
                          } as SyntaxTokenStyle
                        }
                      >
                        {token.content}
                      </span>
                    ))
                  : line || " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
