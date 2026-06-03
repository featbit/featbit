import { apiRequest } from "./http";
import type { Environment, Project } from "./types";

export const projectService = {
  getProjects() {
    return apiRequest<Project[]>("/projects", { method: "GET" });
  },
  getEnvs(projectId: string) {
    return apiRequest<Environment[]>(`/projects/${projectId}/envs`, {
      method: "GET",
    });
  },
};
