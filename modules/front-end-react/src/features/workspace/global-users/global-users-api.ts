import { getCurrentProjectEnv } from "@/features/layout/context";
import { fetchApi } from "@/features/layout/context";

export type CustomizedProperty = {
  name: string;
  value: string;
};

export type GlobalUser = {
  id: string;
  keyId: string;
  name: string;
  customizedProperties: CustomizedProperty[];
};

export type PagedResult<T> = {
  totalCount: number;
  items: T[];
};

export type EndUserFlag = {
  name: string;
  key: string;
  variationType: string;
  variations: { id?: string; name?: string; value: string }[];
  matchVariation: string;
  matchReason: string;
};

export type EndUserSegment = {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
};

function queryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const value = searchParams.toString();
  return value ? `?${value}` : "";
}

export function globalUsersTemplateUrl() {
  return "/assets/upload-global-users.json";
}

export async function fetchGlobalUsers(params: { name: string; pageIndex: number; pageSize: number }) {
  return fetchApi<PagedResult<GlobalUser>>(
    `/api/v1/global-users${queryString({
      name: params.name,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize
    })}`
  );
}

export async function uploadGlobalUsers(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return fetchApi<boolean>("/api/v1/global-users/upload", undefined, true, {
    method: "POST",
    body: formData
  });
}

export async function fetchEndUserFlags(userId: string, params: { searchText: string; pageIndex: number; pageSize: number }) {
  const envId = getCurrentProjectEnv().envId;
  return fetchApi<PagedResult<EndUserFlag>>(
    `/api/v1/envs/${envId}/end-users/${userId}/flags${queryString({
      name: params.searchText,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize
    })}`
  );
}

export async function fetchEndUserSegments(userId: string) {
  const envId = getCurrentProjectEnv().envId;
  return fetchApi<EndUserSegment[]>(`/api/v1/envs/${envId}/end-users/${userId}/segments`);
}
