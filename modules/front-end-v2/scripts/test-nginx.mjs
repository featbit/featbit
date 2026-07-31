import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, "..")
const distDirectory = path.join(projectDirectory, "dist")
const assetsDirectory = path.join(distDirectory, "assets")
const nginxImage = process.env.FEATBIT_NGINX_IMAGE || "nginx:1.30.4"
const baseHref = "/fbtest"
const runningContainers = new Set()

function docker(args, options = {}) {
  return execFileSync("docker", args, {
    cwd: projectDirectory,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  }).trim()
}

function assertBuildOutput() {
  assert.ok(
    existsSync(path.join(distDirectory, "index.html")),
    "Run the production build before testing Nginx."
  )
  assert.ok(
    existsSync(assetsDirectory),
    "The production build does not contain an assets directory."
  )

  const sourceMaps = readdirSync(assetsDirectory).filter((file) =>
    file.endsWith(".map")
  )
  assert.deepEqual(
    sourceMaps,
    [],
    "Production source maps must not be emitted into the public assets directory."
  )
}

function findHashedJavaScriptAsset() {
  const asset = readdirSync(assetsDirectory).find((file) => {
    const fullPath = path.join(assetsDirectory, file)
    return (
      /-[A-Za-z0-9_-]{8,}\.js$/.test(file) && statSync(fullPath).size > 1000
    )
  })

  assert.ok(
    asset,
    "Could not find a hashed JavaScript asset to exercise immutable caching and gzip."
  )
  return asset
}

function uniqueContainerName(mode) {
  return `featbit-nginx-test-${mode}-${process.pid}-${Date.now()}`
}

function startContainer(mode) {
  const name = uniqueContainerName(mode)
  const args = [
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-p",
    "127.0.0.1::80",
    "-v",
    `${distDirectory}:/usr/share/nginx/featbit:ro`,
  ]

  if (mode === "base") {
    args.push(
      "-e",
      `BASE_HREF=${baseHref}`,
      "-v",
      `${path.join(projectDirectory, "nginx.base_href.conf.template")}:/etc/nginx/templates/default.conf.template:ro`
    )
  } else {
    args.push(
      "-v",
      `${path.join(projectDirectory, "nginx.conf.template")}:/etc/nginx/conf.d/default.conf:ro`
    )
  }

  args.push(nginxImage)
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

async function assertHtml(origin, requestPath) {
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
}

async function assertStaticResponses(origin, prefix, hashedAsset) {
  const envResponse = await fetch(`${origin}${prefix}/assets/env.js`)
  assert.equal(envResponse.status, 200)
  assert.equal(envResponse.headers.get("cache-control"), "no-store")
  assertSecurityHeaders(envResponse)

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

async function testDefaultConfiguration(hashedAsset) {
  const container = startContainer("default")
  await waitForServer(container.origin)

  await assertHealthRoutes(container.origin)
  await assertHtml(container.origin, "/")
  await assertHtml(container.origin, "/index.html")
  await assertHtml(container.origin, "/login")
  await assertHtml(container.origin, "/en/feature-flags/checkout.v2/targeting")
  await assertStaticResponses(container.origin, "", hashedAsset)
}

async function testBaseHrefConfiguration(hashedAsset) {
  const container = startContainer("base")
  await waitForServer(container.origin)

  await assertHealthRoutes(container.origin)
  await assertHtml(container.origin, baseHref)
  await assertHtml(container.origin, `${baseHref}/`)
  await assertHtml(container.origin, `${baseHref}/login`)
  await assertHtml(
    container.origin,
    `${baseHref}/en/feature-flags/checkout.v2/targeting`
  )
  await assertStaticResponses(container.origin, baseHref, hashedAsset)

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

assertBuildOutput()
const hashedAsset = findHashedJavaScriptAsset()

try {
  await testDefaultConfiguration(hashedAsset)
  await testBaseHrefConfiguration(hashedAsset)
  console.log(
    "Nginx routing, caching, compression, and security header checks passed."
  )
} finally {
  stopContainers()
}
