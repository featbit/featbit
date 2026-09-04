import { apiRequest } from "./http";
import type { IUserProp } from "./feature-flag-types";

export const userPropertyService = {
  list(envId: string) {
    return apiRequest<IUserProp[]>(
      `/envs/${envId}/end-user-properties`,
      { method: "GET" },
    );
  },
};
