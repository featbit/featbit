import type { ResourceType } from "../permission-model"

export type EditableResourceType = "project" | "env" | "flag" | "segment"
export type ResourcePart = "project" | "env" | "flag" | "segment"

export type ResourceRnValues = Record<ResourcePart | "tags", string>

export const EMPTY_RESOURCE_RN_VALUES: ResourceRnValues = {
  project: "",
  env: "",
  flag: "",
  segment: "",
  tags: "",
}

export const RESOURCE_RN_PARTS: Record<EditableResourceType, ResourcePart[]> = {
  project: ["project"],
  env: ["project", "env"],
  flag: ["project", "env", "flag"],
  segment: ["project", "env", "segment"],
}

export const RESOURCE_RN_PART_LABELS: Record<ResourcePart, string> = {
  project: "project",
  env: "environment",
  flag: "featureFlag",
  segment: "segment",
}

export function isEditableResourceType(
  resourceType: ResourceType
): resourceType is EditableResourceType {
  return resourceType in RESOURCE_RN_PARTS
}

export function parseResourceRn(rn: string): ResourceRnValues {
  const values = { ...EMPTY_RESOURCE_RN_VALUES }

  rn.split(":").forEach((segment) => {
    const [identity, ...parameters] = segment.split(";")
    const separator = identity.indexOf("/")
    if (separator < 0) return

    const type = identity.slice(0, separator) as ResourcePart
    if (!(type in RESOURCE_RN_PART_LABELS)) return

    values[type] = identity.slice(separator + 1)
    if (parameters.length) values.tags = parameters.join(";")
  })

  return values
}

export function buildResourceRn(
  resourceType: EditableResourceType,
  values: ResourceRnValues
) {
  const rn = RESOURCE_RN_PARTS[resourceType]
    .map((part) => `${part}/${values[part].trim()}`)
    .join(":")
  const tags = values.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",")

  return tags && (resourceType === "flag" || resourceType === "segment")
    ? `${rn};${tags}`
    : rn
}
