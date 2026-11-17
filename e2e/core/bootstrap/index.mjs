import { ensureOrganization } from './organization.mjs';
import { ensureFlags } from './flag.mjs';
import { ensureSegment } from './segment.mjs';

export async function ensureBusinessData(stack) {
  const context = await ensureOrganization(stack);
  await ensureFlags(context);
  await ensureSegment(context);
}
