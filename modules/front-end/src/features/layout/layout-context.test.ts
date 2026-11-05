import { beforeEach, describe, expect, it } from "vitest"
import type { Project, ProjectEnv } from "@/features/layout/layout-types"
import {
  clearTabProjectEnv,
  chooseProjectEnv,
  getCurrentProjectEnv,
  getStoredProjectEnv,
  getStoredTabProjectEnv,
  localizedProjectEnvPath,
  resolveTabProjectEnvRequest,
  saveCurrentProjectEnv,
  saveTabProjectEnv,
} from "./layout-context"

const source: ProjectEnv = {
  projectId: "project-source",
  projectName: "Source project",
  projectKey: "source",
  envId: "env-source",
  envName: "Source environment",
  envKey: "source",
}

const target: ProjectEnv = {
  projectId: "project-target",
  projectName: "Target project",
  projectKey: "target",
  envId: "env-target",
  envName: "Target environment",
  envKey: "target",
}

const projects: Project[] = [
  {
    id: target.projectId,
    name: target.projectName,
    key: target.projectKey,
    environments: [
      {
        id: target.envId,
        projectId: target.projectId,
        name: target.envName,
        key: target.envKey,
      },
    ],
  },
]

describe("tab-scoped project environment", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem("auth", JSON.stringify({ id: "user-1" }))
  })

  it("builds a link whose requested environment is validated against projects", () => {
    const href = localizedProjectEnvPath(
      "en",
      "/feature-flags/checkout/targeting",
      target
    )

    expect(href).toBe(
      "/en/feature-flags/checkout/targeting?context=environment&projectId=project-target&envId=env-target"
    )
    expect(
      resolveTabProjectEnvRequest(projects, href.slice(href.indexOf("?")))
    ).toEqual(target)
  })

  it("rejects incomplete or inaccessible explicit environment requests", () => {
    expect(
      resolveTabProjectEnvRequest(projects, "?projectId=project-target")
    ).toBeUndefined()
    expect(
      resolveTabProjectEnvRequest(
        projects,
        "?context=environment&projectId=project-target"
      )
    ).toBeNull()
    expect(
      resolveTabProjectEnvRequest(
        projects,
        "?context=environment&projectId=project-target&envId=env-other"
      )
    ).toBeNull()
  })

  it("keeps the tab environment separate from the persisted default", () => {
    saveCurrentProjectEnv(source)
    saveTabProjectEnv(target)

    expect(getCurrentProjectEnv()).toEqual(target)
    expect(getStoredProjectEnv()).toEqual(source)

    const updatedTarget = { ...target, envName: "Renamed target" }
    saveCurrentProjectEnv(updatedTarget)

    expect(getStoredTabProjectEnv()).toEqual(updatedTarget)
    expect(getStoredProjectEnv()).toEqual(source)

    clearTabProjectEnv()
    expect(getCurrentProjectEnv()).toEqual(source)
  })
})

describe("project environment access", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem("auth", JSON.stringify({ id: "user-1" }))
  })

  it("falls back to the first accessible environment", () => {
    saveCurrentProjectEnv(source)

    expect(chooseProjectEnv(projects)).toEqual(target)
  })

  it("returns null when no environment is accessible", () => {
    saveCurrentProjectEnv(source)

    expect(chooseProjectEnv([])).toBeNull()
    expect(
      chooseProjectEnv([
        {
          id: "project-empty",
          key: "empty",
          name: "Empty project",
          environments: [],
        },
      ])
    ).toBeNull()
  })
})
