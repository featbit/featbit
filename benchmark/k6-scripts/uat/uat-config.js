// UAT Configuration
//
// Supports two modes:
//   1. JSON config file  — set UAT_CONFIG_PATH env var to the file path
//   2. Environment vars  — set individual vars for simpler setups
//
// Environment variables:
//   UAT_CONFIG_PATH       — path to JSON config (output of provision_uat.py)
//   CONTROL_PLANE_URL     — control-plane API base URL
//   CONTROL_PLANE_API_KEY — API key for admin endpoints
//   TEST_APP_URLS         — comma-separated list of test app base URLs
//   INSTANCE_COUNT        — number of test app instances (used with TEST_APP_BASE_URL pattern)
//   TEST_APP_BASE_URL     — URL pattern with {i} placeholder (e.g. http://test-app-{i}:8080)

const DEFAULT_TEST_CONFIG = {
  healthCheckTimeoutMs: 5000,
  connectSettleMs: 2000,
  preFullSyncSettleMs: 3000,
  fullSyncPropagationMs: 5000,
  disconnectSettleMs: 1000,
  kafkaPropagationMs: 5000,
};

function loadFromFile(path) {
  // k6 open() reads a file at init time (relative to the script or absolute)
  const raw = open(path);
  return JSON.parse(raw);
}

function buildFromEnv() {
  const controlPlaneUrl = __ENV.CONTROL_PLANE_URL || 'http://localhost:5000';
  const controlPlaneApiKey = __ENV.CONTROL_PLANE_API_KEY || '';

  let instances = [];

  if (__ENV.TEST_APP_URLS) {
    // Comma-separated list: http://app1:8080,http://app2:8080
    const urls = __ENV.TEST_APP_URLS.split(',').map((u) => u.trim());
    instances = urls.map((url, i) => ({
      instanceId: `test-app-${i + 1}`,
      baseUrl: url,
      envSecret: '',
      flagKeys: [],
    }));
  } else if (__ENV.TEST_APP_BASE_URL) {
    // Pattern with {i}: http://test-app-{i}:8080
    const count = parseInt(__ENV.INSTANCE_COUNT || '3', 10);
    for (let i = 1; i <= count; i++) {
      instances.push({
        instanceId: `test-app-${i}`,
        baseUrl: __ENV.TEST_APP_BASE_URL.replace('{i}', String(i)),
        envSecret: '',
        flagKeys: [],
      });
    }
  } else {
    // Single default instance
    instances.push({
      instanceId: 'test-app-1',
      baseUrl: __ENV.TEST_APP_URL || 'http://localhost:8080',
      envSecret: '',
      flagKeys: [],
    });
  }

  return { controlPlaneUrl, controlPlaneApiKey, instances };
}

function loadConfig() {
  let controlPlaneUrl;
  let controlPlaneApiKey;
  let instances;
  let testConfig = Object.assign({}, DEFAULT_TEST_CONFIG);

  if (__ENV.UAT_CONFIG_PATH) {
    const cfg = loadFromFile(__ENV.UAT_CONFIG_PATH);

    controlPlaneUrl = cfg.controlPlaneUrl || __ENV.CONTROL_PLANE_URL || 'http://localhost:5000';
    controlPlaneApiKey = cfg.controlPlaneApiKey || __ENV.CONTROL_PLANE_API_KEY || '';
    instances = (cfg.instances || []).map((inst, i) => ({
      instanceId: inst.instanceId || inst.instance_id || `test-app-${i + 1}`,
      baseUrl: inst.baseUrl || inst.base_url || '',
      envSecret: inst.envSecret || inst.env_secret || '',
      projectKey: inst.projectKey || inst.project_key || '',
      environmentId: inst.environmentId || inst.environment_id || '',
      flagKeys: inst.flagKeys || inst.flag_keys || [],
    }));

    // Override baseUrls from TEST_APP_URLS env var (port-forward URLs)
    if (__ENV.TEST_APP_URLS) {
      const urls = __ENV.TEST_APP_URLS.split(',').map((u) => u.trim());
      for (let i = 0; i < instances.length && i < urls.length; i++) {
        instances[i].baseUrl = urls[i];
      }
    }

    if (cfg.testConfig) {
      testConfig = Object.assign(testConfig, cfg.testConfig);
    }
  } else {
    const env = buildFromEnv();
    controlPlaneUrl = env.controlPlaneUrl;
    controlPlaneApiKey = env.controlPlaneApiKey;
    instances = env.instances;
  }

  // Allow env overrides even when using a config file
  if (__ENV.CONTROL_PLANE_URL) {
    controlPlaneUrl = __ENV.CONTROL_PLANE_URL;
  }
  if (__ENV.CONTROL_PLANE_API_KEY) {
    controlPlaneApiKey = __ENV.CONTROL_PLANE_API_KEY;
  }

  return { controlPlaneUrl, controlPlaneApiKey, instances, testConfig };
}

export const config = loadConfig();
export const { controlPlaneUrl, controlPlaneApiKey, instances, testConfig } = config;
