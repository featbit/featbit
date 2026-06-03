/**
 * Mint a track-service env secret for a given envId.
 *
 *   TRACK_SERVICE_SIGNING_KEY=... npx tsx scripts/generate-env-secret.ts <envId>
 *
 * Output is the full token string — paste into SDK config / worker env
 * (ENV_SECRET), where it goes straight into the Authorization header when
 * talking to track-service.
 */
import "dotenv/config";
import { signEnvSecret } from "../src/lib/track/env-secret";

function main() {
  const envId = process.argv[2];
  if (!envId) {
    console.error("Usage: generate-env-secret <envId>");
    process.exit(1);
  }

  if (!process.env.TRACK_SERVICE_SIGNING_KEY) {
    console.error(
      "TRACK_SERVICE_SIGNING_KEY is not set. Set the same value that " +
        "track-service is running with, or the token will be rejected.",
    );
    process.exit(1);
  }

  const token = signEnvSecret(envId);
  console.log(token);
}

main();
