import { apiRequest } from "./http";
import type { Organization, Profile, Workspace } from "./types";

export const userService = {
  getProfile() {
    return apiRequest<Profile>("/user/profile", { method: "GET" });
  },
  getWorkspaces() {
    return apiRequest<Workspace[]>("/user/workspaces", { method: "GET" });
  },
  getWorkspace() {
    return apiRequest<Workspace>("/workspaces", { method: "GET" });
  },
  getOrganizations(isSsoFirstLogin = false) {
    return apiRequest<Organization[]>("/organizations", {
      method: "GET",
      query: { isSsoFirstLogin },
    });
  },
};
