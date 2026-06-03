import { apiRequest } from "./http";
import type { Organization, Profile, Workspace } from "./types";

export const userService = {
  getProfile() {
    return apiRequest<Profile>("/user/profile", { method: "GET" });
  },
  hasMultipleWorkspaces(email: string) {
    return apiRequest<boolean>("/user/has-multiple-workspaces", {
      method: "POST",
      body: { email },
      skipAuth: true,
    });
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
