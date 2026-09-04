import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { identityService } from "@/lib/featbit-auth/identity-service";
import { FeatBitApiError } from "@/lib/featbit-auth/http";
import { Loader2 } from "lucide-react";

interface Props {
  onAuthenticated: (token: string) => Promise<void> | void;
}

export function PasswordLoginForm({ onAuthenticated }: Props) {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identity.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await identityService.loginByEmail(
          identity.trim(),
          password,
        );
        await onAuthenticated(result.token);
      } catch (err) {
        setError(
          err instanceof FeatBitApiError
            ? err.message
            : "Login failed. Please check your credentials.",
        );
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="identity">Email</Label>
        <Input
          id="identity"
          type="email"
          autoComplete="email"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          disabled={isPending}
          placeholder="you@company.com"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
