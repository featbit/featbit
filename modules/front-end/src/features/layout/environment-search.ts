import type { Project } from "./layout-types"

function matchScore(values: string[], query: string): number {
  if (values.some((value) => value === query)) return 4
  if (values.some((value) => value.startsWith(query))) return 3
  if (values.some((value) => value.includes(query))) return 2
  return 0
}

function resultScore(fields: string[], query: string, words: string[]): number {
  const whole = matchScore(fields, query)
  if (whole || words.length === 1) return whole

  // Combined matches rank below whole-query matches. Each word must match.
  let total = 0
  for (const word of words) {
    const score = matchScore(fields, word)
    if (!score) return 0
    total += score
  }
  return total / (4 * words.length)
}

export function searchEnvironments(
  projects: Project[],
  search: string,
  currentProjectId?: string
): Project[] {
  const available = projects.filter(
    (project) => project.environments.length > 0
  )
  const query = search.trim().toLowerCase()
  if (!query) {
    return available.sort(
      (a, b) =>
        Number(b.id === currentProjectId) - Number(a.id === currentProjectId)
    )
  }

  const words = query.split(/\s+/)
  return available
    .map((project) => {
      const fields = [project.name.toLowerCase(), project.key.toLowerCase()]
      const projectScore = matchScore(fields, query)
      const matches = project.environments
        .map((environment) => {
          const environmentFields = [
            environment.name.toLowerCase(),
            environment.key?.toLowerCase() ?? "",
          ]
          return {
            environment,
            score: resultScore([...fields, ...environmentFields], query, words),
            environmentScore: matchScore(environmentFields, query),
          }
        })
        .filter((match) => match.score > 0)
        .sort(
          (a, b) => b.score - a.score || b.environmentScore - a.environmentScore
        )

      return {
        project: {
          ...project,
          environments: matches.map(({ environment }) => environment),
        },
        projectScore,
        bestScore: matches[0]?.score ?? 0,
      }
    })
    .filter(({ project }) => project.environments.length > 0)
    .sort(
      (a, b) => b.bestScore - a.bestScore || b.projectScore - a.projectScore
    )
    .map(({ project }) => project)
}
