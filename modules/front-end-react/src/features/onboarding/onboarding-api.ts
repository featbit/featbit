import { fetchApi } from "@/features/layout/context";

export type OnboardingPayload = {
  organizationName: string;
  organizationKey: string;
  projectName: string;
  projectKey: string;
  environments: string[];
};

export async function completeOnboarding(payload: OnboardingPayload) {
  return fetchApi<boolean>("/api/v1/organizations/onboarding", undefined, true, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
