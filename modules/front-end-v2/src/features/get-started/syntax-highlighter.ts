export type SyntaxToken = {
  content: string
  lightColor: string
  darkColor: string
}

export type HighlightedCode = SyntaxToken[][]

const languageByLabel = {
  "C#": "csharp",
  Go: "go",
  Java: "java",
  JavaScript: "javascript",
  Python: "python",
  TypeScript: "typescript",
} as const

const highlightCache = new Map<string, Promise<HighlightedCode>>()

export function highlightCode(code: string, language: string) {
  const source = code.trim()
  const languageId =
    languageByLabel[language as keyof typeof languageByLabel] ?? "text"
  const cacheKey = `${languageId}:${source}`
  const cached = highlightCache.get(cacheKey)
  if (cached) return cached

  const task = import("shiki").then(async ({ codeToTokens }) => {
    const result = await codeToTokens(source, {
      lang: languageId,
      themes: {
        light: "github-light-default",
        dark: "github-dark-default",
      },
    })

    return result.tokens.map((line) =>
      line.map((token) => ({
        content: token.content,
        lightColor: String(token.htmlStyle?.color ?? "currentColor"),
        darkColor: String(token.htmlStyle?.["--shiki-dark"] ?? "currentColor"),
      }))
    )
  })

  highlightCache.set(cacheKey, task)
  void task.catch(() => highlightCache.delete(cacheKey))
  return task
}
