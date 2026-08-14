import { apiRequest } from "./http";
import type {
  FeatureFlagListFilter,
  IFeatureFlag,
  IFeatureFlagListModel,
  UpdateFlagTargetingPayload,
} from "./feature-flag-types";

function buildListQuery(filter: FeatureFlagListFilter) {
  const pageIndex = Math.max(1, filter.pageIndex ?? 1) - 1;
  const pageSize = filter.pageSize ?? 20;
  const query: Record<string, string | number | boolean | undefined> = {
    name: filter.name ?? "",
    isArchived: filter.isArchived ?? false,
    pageIndex,
    pageSize,
  };
  if (filter.sortBy) query.sortBy = filter.sortBy;
  if (filter.isEnabled !== undefined) query.isEnabled = filter.isEnabled;
  return query;
}

export const featureFlagService = {
  list(envId: string, filter: FeatureFlagListFilter = {}) {
    const query = buildListQuery(filter);
    // Arrays (tags) can't go through the simple query helper — append manually.
    const path = `/envs/${envId}/feature-flags`;
    if (filter.tags && filter.tags.length) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, String(v));
      });
      filter.tags.forEach((t) => params.append("tags", t));
      return apiRequest<IFeatureFlagListModel>(`${path}?${params.toString()}`, {
        method: "GET",
      });
    }
    return apiRequest<IFeatureFlagListModel>(path, { method: "GET", query });
  },

  getByKey(envId: string, key: string) {
    return apiRequest<IFeatureFlag>(
      `/envs/${envId}/feature-flags/${encodeURIComponent(key)}`,
      { method: "GET" },
    );
  },

  updateTargeting(
    envId: string,
    key: string,
    payload: UpdateFlagTargetingPayload,
  ) {
    // Response: server returns new revision string.
    return apiRequest<string>(
      `/envs/${envId}/feature-flags/${encodeURIComponent(key)}/targeting`,
      { method: "PUT", body: payload },
    );
  },
};
