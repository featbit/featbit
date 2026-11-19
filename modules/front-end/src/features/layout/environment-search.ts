import type { Project } from "./layout-types"

function matchScore(fields: (string | undefined)[], query: string): number {
  const values = fields.map((field) => (field ?? "").toLowerCase())
  if (values.some((value) => value === query)) return 4
  if (values.some((value) => value.startsWith(query))) return 3
  if (values.some((value) => value.includes(query))) return 2
  return query
    .split(/\s+/)
    .every((word) => values.some((value) => value.includes(word)))
    ? 1
    : 0
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

  return available
    .map((project) => {
      const fields = [project.name, project.key]
      const projectScore = matchScore(fields, query)
      const matches = project.environments
        .map((environment) => ({
          environment,
          score: matchScore([environment.name, environment.key], query),
        }))
        .filter(
          ({ environment }) =>
            projectScore > 0 ||
            matchScore([...fields, environment.name, environment.key], query) >
              0
        )
        .sort((a, b) => b.score - a.score)

      return {
        project: {
          ...project,
          environments: matches.map(({ environment }) => environment),
        },
        projectScore,
        environmentScore: matches[0]?.score ?? 0,
      }
    })
    .filter(({ project }) => project.environments.length > 0)
    .sort(
      (a, b) =>
        b.projectScore - a.projectScore ||
        b.environmentScore - a.environmentScore
    )
    .map(({ project }) => project)
}
