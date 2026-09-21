import { z } from "zod"

// The run API stores the threshold as a nullable .NET Int32. Zero disables it;
// null in a partial update leaves the existing value unchanged.
export const MAXIMUM_SAMPLE = 2_147_483_647

export const minimumSampleSchema = z.object({
  minimumSample: z
    .string()
    .trim()
    .transform(Number)
    .pipe(z.number().int().min(0).max(MAXIMUM_SAMPLE)),
})

export type MinimumSampleFormValues = z.input<typeof minimumSampleSchema>
export type MinimumSampleUpdate = z.output<typeof minimumSampleSchema>
