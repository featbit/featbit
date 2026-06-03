"use client";

import { useAuth } from "@/lib/featbit-auth/auth-context";
import { EnvSecretCard } from "@/components/env-settings/env-secret-card";
import { ConnectorUrlCard } from "@/components/env-settings/connector-url-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layers, FolderClosed, Building2 } from "lucide-react";

export default function EnvSettingsPage() {
  const { organization, currentProject, currentEnvironment } = useAuth();

  return (
    <div className="h-[calc(100svh-2.75rem)] overflow-y-auto">
      <div className="max-w-3xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Environment settings</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Credentials and identifiers for the environment currently selected
            in the top-right switcher. Switching envs updates every field on
            this page.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current environment</CardTitle>
            <CardDescription>
              Scope of everything shown below. Change it from the workspace
              switcher.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-3.5" />
              <span>Organization</span>
            </div>
            <div className="font-medium">{organization?.name ?? "—"}</div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderClosed className="size-3.5" />
              <span>Project</span>
            </div>
            <div className="font-medium">{currentProject?.name ?? "—"}</div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="size-3.5" />
              <span>Environment</span>
            </div>
            <div className="font-medium">
              {currentEnvironment?.name ?? "—"}
              {currentEnvironment?.id && (
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  {currentEnvironment.id}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Env secret</CardTitle>
            <CardDescription>
              Signed token that SDKs and workers pass to track-service as the{" "}
              <code>Authorization</code> header. Track-service parses the envId
              back out of the token and verifies the signature on every
              request — the plain envId is what lands in ClickHouse as the
              partition key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnvSecretCard bare />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Claude Code connector URL</CardTitle>
            <CardDescription>
              Where the chat panel reaches{" "}
              <code>npx @featbit/experimentation-claude-code-connector</code>{" "}
              when you use the <strong>Local Claude Code</strong> agent mode.
              Default is <code>http://127.0.0.1:3100</code>; override if you
              start the connector on a different port (e.g. when 3100 is
              already taken on your machine).
              <br />
              <span className="text-amber-700 dark:text-amber-500 font-medium">
                Stored in this browser&apos;s localStorage only — not synced
                to the server, not tied to project / environment / workspace,
                not shared with other users or other browsers on your machine.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectorUrlCard />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
