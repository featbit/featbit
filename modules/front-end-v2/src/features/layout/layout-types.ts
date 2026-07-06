import type { ComponentType, SVGProps } from "react"

export type Lang = "en" | "zh"

export type Icon = ComponentType<SVGProps<SVGSVGElement>>

export type EnvironmentType = "prod" | "staging" | "dev"

export type Environment = {
  id: string
  projectId?: string
  name: string
  key?: string
  type?: EnvironmentType
}

export type Project = {
  id: string
  name: string
  key: string
  environments: Environment[]
}

export type ProjectEnv = {
  projectId: string
  projectName: string
  projectKey: string
  envId: string
  envName: string
  envKey: string
  envType: EnvironmentType
}

export type Organization = {
  id: string
  name: string
  key: string
  initialized?: boolean
}

export type Workspace = {
  id: string
  name: string
  key: string
  license?: string
}

export type NavItem = {
  labelKey: string
  href: string
  icon: Icon
  children?: NavItem[]
}

export type NavGroup = {
  labelKey: string
  items: NavItem[]
}
