import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, "..")
const imageVersion = "nginx-test"
const testImage = `featbit-front-end-nginx-test:${process.pid}-${Date.now()}`
const baseHref = "/fbtest"
const runtimeEnvironment = {
  API_URL: "https://api.example.test",
  DEMO_URL: "https://demo.example.test",
  EVALUATION_URL: "https://evaluation.example.test",
  DISPLAY_API_URL: "https://display-api.example.test",
  DISPLAY_EVALUATION_URL: "https://display-evaluation.example.test",
  HOSTING_MODE: "self-hosted",
}
const runningContainers = new Set()
let imageBuilt = false

function docker(args, options = {}) {
  const output = execFileSync("docker", args, {
    cwd: projectDirectory,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  })

  return typeof output === "string" ? output.trim() : ""
}

function buildTestImage() {
  console.log(`Building test image ${testImage} from the project Dockerfile.`)
  docker(
    [
      "build",
      "--build-arg",
      `VERSION=${imageVersion}`,
      "--tag",
      testImage,
      ".",
    ],
    { stdio: "inherit" }
  )
  imageBuilt = true
}

function uniqueContainerName(mode) {
  return `featbit-nginx-test-${mode}-${process.pid}-${Date.now()}`
}

function startContainer(mode) {
  const name = uniqueContainerName(mode)
  const args = ["run", "--rm", "-d", "--name", name, "-p", "127.0.0.1::80"]

  for (const [key, value] of Object.entries(runtimeEnvironment)) {
    args.push("-e", `${key}=${value}`)
  }

  if (mode === "base") {
    args.push("-e", `BASE_HREF=${baseHref}/`)
  }

  args.push(testImage)
  docker(args)
  runningContainers.add(name)

  const binding = docker(["port", name, "80/tcp"])
  const port = binding.match(/:(\d+)$/)?.[1]
  assert.ok(port, `Could not determine the published port for ${name}.`)

  return {
    name,
    origin: `http://127.0.0.1:${port}`,
  }
}

async function waitForServer(origin, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/health`)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(
    `Timed out waiting for ${origin}/health${lastError ? `: ${lastError.message}` : ""}`
  )
}

async function request(origin, requestPath, options) {
  const response = await fetch(`${origin}${requestPath}`, options)
  const body = await response.text()
  return { response, body }
}

function assertSecurityHeaders(response) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin"
  )
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN")
  assert.equal(
    response.headers.get("content-security-policy"),
    "frame-ancestors 'self'"
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function assertHtml(origin, requestPath, prefix) {
  const { response, body } = await request(origin, requestPath)
  assert.equal(
    response.status,
    200,
    `${requestPath} should serve the SPA shell.`
  )
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/)
  assert.match(body, /<div id="root"><\/div>/)
  assertSecurityHeaders(response)

  const assetPrefix = `${prefix}/assets/`
  assert.match(
    body,
    new RegExp(`href="${escapeRegExp(assetPrefix)}featbit-logo\\.svg"`),
    `${requestPath} should reference the expected favicon path.`
  )

  if (prefix) {
    assert.doesNotMatch(
      body,
      /(?:href|src)="\/assets\//,
      `${requestPath} should not contain root-relative asset paths.`
    )
  }

  const hashedAsset = body.match(
    new RegExp(
      `src="${escapeRegExp(assetPrefix)}([^"/]+-[A-Za-z0-9_-]{8,}\\.js)"`
    )
  )?.[1]
  assert.ok(
    hashedAsset,
    `${requestPath} should reference a hashed JavaScript entry asset.`
  )

  return hashedAsset
}

async function assertRuntimeEnvironment(origin, prefix, expectedBaseHref) {
  const { response, body } = await request(origin, `${prefix}/assets/env.js`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.match(
    response.headers.get("content-type") || "",
    /^(?:application|text)\/javascript\b/
  )
  assertSecurityHeaders(response)

  const expectedEnvironment = {
    ...runtimeEnvironment,
    BASE_HREF: expectedBaseHref,
    VERSION: imageVersion,
  }

  for (const [key, value] of Object.entries(expectedEnvironment)) {
    assert.ok(
      body.includes(`${key}: ${JSON.stringify(value)}`),
      `env.js should contain ${key}.`
    )
  }
}

async function assertStaticResponses(
  origin,
  prefix,
  hashedAsset,
  expectedBaseHref
) {
  await assertRuntimeEnvironment(origin, prefix, expectedBaseHref)

  const assetResponse = await fetch(
    `${origin}${prefix}/assets/${hashedAsset}`,
    {
      headers: { "Accept-Encoding": "gzip" },
    }
  )
  await assetResponse.arrayBuffer()
  assert.equal(assetResponse.status, 200)
  assert.equal(
    assetResponse.headers.get("cache-control"),
    "public, max-age=31536000, immutable"
  )
  assert.equal(assetResponse.headers.get("content-encoding"), "gzip")
  assert.match(
    assetResponse.headers.get("vary") || "",
    /(?:^|,\s*)Accept-Encoding(?:,|$)/i
  )
  assertSecurityHeaders(assetResponse)

  const logoResponse = await fetch(`${origin}${prefix}/assets/featbit-logo.svg`)
  assert.equal(logoResponse.status, 200)
  assert.equal(
    logoResponse.headers.get("cache-control"),
    "public, max-age=2592000"
  )

  const missingAssetResponse = await fetch(
    `${origin}${prefix}/assets/does-not-exist.js`
  )
  assert.equal(missingAssetResponse.status, 404)

  const sourceMapResponse = await fetch(
    `${origin}${prefix}/assets/${hashedAsset}.map`
  )
  assert.equal(sourceMapResponse.status, 404)
}

async function assertHealthRoutes(origin) {
  const health = await request(origin, "/health")
  assert.equal(health.response.status, 200)
  assert.equal(health.response.headers.get("cache-control"), "no-store")
  assert.equal(health.response.headers.get("content-type"), "text/plain")
  assert.equal(health.body, "healthy\n")
  assertSecurityHeaders(health.response)

  const invalidHealth = await fetch(`${origin}/health/unexpected`)
  assert.equal(invalidHealth.status, 404)
}

async function testDefaultConfiguration() {
  const container = startContainer("default")
  await waitForServer(container.origin)

  await assertHealthRoutes(container.origin)
  const hashedAsset = await assertHtml(container.origin, "/", "")
  await assertHtml(container.origin, "/index.html", "")
  await assertHtml(container.origin, "/login", "")
  await assertHtml(
    container.origin,
    "/en/feature-flags/checkout.v2/targeting",
    ""
  )
  await assertStaticResponses(container.origin, "", hashedAsset, "")
}

async function testBaseHrefConfiguration() {
  const container = startContainer("base")
  await waitForServer(container.origin)

  await assertHealthRoutes(container.origin)
  const hashedAsset = await assertHtml(container.origin, baseHref, baseHref)
  await assertHtml(container.origin, `${baseHref}/`, baseHref)
  await assertHtml(container.origin, `${baseHref}/login`, baseHref)
  await assertHtml(
    container.origin,
    `${baseHref}/en/feature-flags/checkout.v2/targeting`,
    baseHref
  )
  await assertStaticResponses(container.origin, baseHref, hashedAsset, baseHref)

  assert.equal((await fetch(`${container.origin}/`)).status, 404)
  assert.equal((await fetch(`${container.origin}/index.html`)).status, 404)
  assert.equal((await fetch(`${container.origin}/assets/env.js`)).status, 404)
}

function stopContainers() {
  for (const name of runningContainers) {
    try {
      docker(["stop", name], { stdio: "ignore" })
    } catch {
      // The container may already have exited and removed itself.
    }
  }
}

function removeTestImage() {
  if (!imageBuilt) return

  try {
    docker(["image", "rm", testImage], { stdio: "ignore" })
  } catch {
    // Keep the original test result if Docker cannot remove the temporary image.
  }
}

try {
  buildTestImage()
  await testDefaultConfiguration()
  await testBaseHrefConfiguration()
  console.log(
    "Built-image entrypoint, runtime environment, routing, caching, compression, and security header checks passed."
  )
} finally {
  stopContainers()
  removeTestImage()
}
