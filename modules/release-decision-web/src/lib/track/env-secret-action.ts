export interface MintEnvSecretResult {
  envSecret: string | null;
  hasSigningKey: boolean;
}

export async function mintEnvSecret(envId: string): Promise<MintEnvSecretResult> {
  if (!envId) return { envSecret: null, hasSigningKey: false };

  return {
    envSecret: envId,
    hasSigningKey: false,
  };
}
