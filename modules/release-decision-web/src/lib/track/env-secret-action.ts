"use server";

import { signEnvSecret } from "./env-secret";

export interface MintEnvSecretResult {
  envSecret: string | null;
  hasSigningKey: boolean;
}

export async function mintEnvSecret(envId: string): Promise<MintEnvSecretResult> {
  const hasSigningKey = !!process.env.TRACK_SERVICE_SIGNING_KEY;
  if (!envId) return { envSecret: null, hasSigningKey };
  return { envSecret: signEnvSecret(envId), hasSigningKey };
}
