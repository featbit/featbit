/**
 * Pure-TypeScript statistical distribution functions.
 *
 * Replaces scipy.stats.norm, scipy.stats.truncnorm, scipy.stats.chi2
 * used by the Python Bayesian analysis code. Zero external dependencies.
 */

const SQRT2 = Math.sqrt(2);
const SQRT2PI = Math.sqrt(2 * Math.PI);

// ═══════════════════════════════════════════════════════════════════════════
// ERROR FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Error function approximation (Abramowitz & Stegun 7.1.26).
 * Max absolute error: 1.5×10⁻⁷
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * ax);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-ax * ax);

  return sign * y;
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMAL DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════

/** Standard normal PDF: φ(x) */
export function normalPDF(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT2PI);
}

/** Normal CDF: Φ(x) */
export function normalCDF(x: number, mu = 0, sigma = 1): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * SQRT2)));
}

/** Normal survival function: 1 − Φ(x) */
export function normalSF(x: number, mu = 0, sigma = 1): number {
  return 1 - normalCDF(x, mu, sigma);
}

/**
 * Normal inverse CDF (PPF / quantile function).
 * Peter Acklam's rational approximation — accurate to ~1.15×10⁻⁹.
 */
export function normalPPF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRUNCATED NORMAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mean of a truncated normal: E[X | a < X ≤ b] where X ~ N(μ, σ²).
 *
 * Formula: μ + σ · [φ(α) − φ(β)] / [Φ(β) − Φ(α)]
 * where α = (a−μ)/σ, β = (b−μ)/σ, φ = standard normal PDF, Φ = standard normal CDF.
 */
export function truncatedNormalMean(
  mu: number,
  sigma: number,
  a: number,
  b: number,
): number {
  const phiAlpha = isFinite(a) ? normalPDF((a - mu) / sigma) : 0;
  const phiBeta = isFinite(b) ? normalPDF((b - mu) / sigma) : 0;
  const cdfAlpha = isFinite(a) ? normalCDF((a - mu) / sigma) : 0;
  const cdfBeta = isFinite(b) ? normalCDF((b - mu) / sigma) : 1;

  const denom = cdfBeta - cdfAlpha;
  if (denom <= 0) return mu;

  return mu + sigma * (phiAlpha - phiBeta) / denom;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHI-SQUARED DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════

/** Log-gamma via Lanczos approximation (g=7, n=9 coefficients). */
function lnGamma(x: number): number {
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
    );
  }

  x -= 1;
  let sum = coef[0];
  for (let i = 1; i <= 8; i++) {
    sum += coef[i] / (x + i);
  }

  const t = x + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum)
  );
}

/** Regularized lower incomplete gamma P(a, x) — series expansion. */
function gammaPSeries(a: number, x: number): number {
  const lna = lnGamma(a);
  let sum = 1.0 / a;
  let term = 1.0 / a;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lna);
}

/** Regularized upper incomplete gamma Q(a, x) — continued fraction (modified Lentz). */
function gammaQCF(a: number, x: number): number {
  const lna = lnGamma(a);
  const tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1.0 / tiny;
  let d = 1.0 / b;
  let h = d;

  for (let n = 1; n < 200; n++) {
    const an = -n * (n - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < 1e-14) break;
  }

  return h * Math.exp(-x + a * Math.log(x) - lna);
}

/** Regularized lower incomplete gamma function P(a, x) = γ(a,x) / Γ(a). */
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    return gammaPSeries(a, x);
  }
  return 1.0 - gammaQCF(a, x);
}

/**
 * Chi-squared survival function: P(X > x) where X ~ χ²(df).
 *
 * chi2.sf(x, df) = 1 − P(df/2, x/2) where P is the regularized lower
 * incomplete gamma function.
 */
export function chi2SF(x: number, df: number): number {
  if (x <= 0) return 1.0;
  return 1.0 - regularizedGammaP(df / 2, x / 2);
}
