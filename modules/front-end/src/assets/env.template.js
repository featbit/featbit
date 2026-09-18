(function(window) {
  window.env = window.env || {};

  // Environment variables
  window["env"]["apiUrl"] = "${API_URL}";
  window["env"]["demoUrl"] = "${DEMO_URL}";
  window["env"]["evaluationUrl"] = "${EVALUATION_URL}";
  window["env"]["displayApiUrl"] = "${DISPLAY_API_URL}";
  window["env"]["displayEvaluationUrl"] = "${DISPLAY_EVALUATION_URL}";
  window["env"]["hostingMode"] = "${HOSTING_MODE}";
  window["env"]["showEnvSecretsInHeader"] = "${SHOW_ENV_SECRETS_IN_HEADER}";
  window["env"]["version"] = "${VERSION}";
})(this);
