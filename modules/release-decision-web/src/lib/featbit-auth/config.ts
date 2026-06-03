// Server-side absolute URL. The analyze route uses this for its server-side
// FeatBit API hop. Browser code uses FEATBIT_BROWSER_API_V1 below.
export const FEATBIT_API_URL = (
  process.env.FEATBIT_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const FEATBIT_API_V1 = `${FEATBIT_API_URL}/api/v1`;

// What browser code uses for direct FeatBit API calls. In the embedded
// Angular flow this normally points at http://localhost:5000/api/v1 and sends
// the same localStorage token Angular uses.
export const FEATBIT_BROWSER_API_URL = (
  process.env.NEXT_PUBLIC_FEATBIT_API_URL ||
  process.env.FEATBIT_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export const FEATBIT_BROWSER_API_V1 = FEATBIT_BROWSER_API_URL.endsWith("/api/v1")
  ? FEATBIT_BROWSER_API_URL
  : `${FEATBIT_BROWSER_API_URL}/api/v1`;
