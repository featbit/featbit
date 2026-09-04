import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export type VariantIdentity = {
  key: string;
  name?: string;
  value?: string;
  description?: string;
};

export function parseVariantIdentities(
  variants: string | null | undefined,
): VariantIdentity[] {
  if (!variants) return [];
  const raw = variants.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        key?: string;
        id?: string;
        name?: string;
        value?: string;
        description?: string;
      }>;

      return parsed
        .map((variant) => ({
          key: variant.key ?? variant.id ?? variant.value ?? variant.name ?? "",
          name: variant.name ?? "",
          value: variant.value ?? "",
          description: variant.description ?? "",
        }))
        .filter((variant) => variant.key);
    } catch {
      return [];
    }
  }

  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)\s*\((.+)\)\s*$/);
      return match
        ? { key: match[1].trim(), description: match[2].trim() }
        : { key: item };
    });
}

export function splitVariantTokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function shortVariantId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id;
}

export function findVariantIdentity(
  token: string | null | undefined,
  variants: VariantIdentity[],
): VariantIdentity | null {
  if (!token) return null;
  return (
    variants.find(
      (variant) =>
        variant.key === token ||
        variant.value === token ||
        variant.name === token ||
        variant.description === token,
    ) ?? { key: token }
  );
}

function normalized(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function displayName(variant: VariantIdentity): string {
  const name = normalized(variant.name);
  if (name) return name;

  const value = normalized(variant.value);
  if (value) return value;

  const description = normalized(variant.description);
  if (description) return description;

  return shortVariantId(variant.key);
}

export function formatVariantPlain(
  token: string | null | undefined,
  variants: VariantIdentity[],
): string {
  const variant = findVariantIdentity(token, variants);
  if (!variant) return "not set";

  const name = displayName(variant);
  const value = normalized(variant.value);
  const hasMetadata = Boolean(
    normalized(variant.name) ||
      normalized(variant.value) ||
      normalized(variant.description),
  );
  const parts = [name];

  if (value && value !== name) {
    parts.push(value);
  }

  if (hasMetadata) {
    parts.push(shortVariantId(variant.key));
  }

  return parts.join(" / ");
}

export function VariantIdCopyButton({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(id);
      }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      title={`Copy variation id: ${id}`}
      aria-label="Copy variation id"
    >
      <Copy className="size-3" />
    </button>
  );
}

export function VariantIdentityInline({
  token,
  variants,
  role,
  className,
  showCopy = true,
}: {
  token: string | null | undefined;
  variants: VariantIdentity[];
  role?: string;
  className?: string;
  showCopy?: boolean;
}) {
  const variant = findVariantIdentity(token, variants);

  if (!variant) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        {role && <span className="shrink-0 text-muted-foreground">{role}:</span>}
        <span className="italic text-muted-foreground">not set</span>
      </span>
    );
  }

  const name = displayName(variant);
  const value = normalized(variant.value);
  const explicitName = normalized(variant.name);
  const hasMetadata = Boolean(
    explicitName ||
      normalized(variant.value) ||
      normalized(variant.description),
  );
  const showValue = value && (value !== name || Boolean(explicitName));
  const showId = hasMetadata && variant.key;

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      title={formatVariantPlain(variant.key, variants)}
    >
      {role && <span className="shrink-0 text-muted-foreground">{role}:</span>}
      <span className="min-w-0 truncate font-medium">{name}</span>
      {showValue && (
        <span className="min-w-0 max-w-[45%] shrink truncate rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.85em] text-muted-foreground">
          {value}
        </span>
      )}
      {showId && (
        <span className="inline-flex min-w-0 shrink items-center gap-0.5">
          <span className="min-w-0 truncate font-mono text-[0.9em] text-muted-foreground">
            {shortVariantId(variant.key)}
          </span>
          {showCopy && <VariantIdCopyButton id={variant.key} className="size-5" />}
        </span>
      )}
      {!hasMetadata && showCopy && (
        <VariantIdCopyButton id={variant.key} className="size-5" />
      )}
    </span>
  );
}
