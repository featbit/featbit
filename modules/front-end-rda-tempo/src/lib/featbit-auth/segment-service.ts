import { apiRequest } from "./http";
import type {
  ISegment,
  ISegmentListModel,
  SegmentListFilter,
} from "./feature-flag-types";

export const segmentService = {
  list(envId: string, filter: SegmentListFilter = {}) {
    const pageIndex = Math.max(1, filter.pageIndex ?? 1) - 1;
    return apiRequest<ISegmentListModel>(`/envs/${envId}/segments`, {
      method: "GET",
      query: {
        name: filter.name ?? "",
        isArchived: filter.isArchived ?? false,
        pageIndex,
        pageSize: filter.pageSize ?? 20,
      },
    });
  },

  getByIds(envId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve<ISegment[]>([]);
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("ids", id));
    return apiRequest<ISegment[]>(
      `/envs/${envId}/segments/by-ids?${params.toString()}`,
      { method: "GET" },
    );
  },
};
