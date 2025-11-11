(function(window) {
  window.env = window.env || {};

  // Environment variables
  window["env"]["apiUrl"] = "${API_URL}";
  window["env"]["demoUrl"] = "${DEMO_URL}";
  window["env"]["evaluationUrl"] = "${EVALUATION_URL}";
  window["env"]["featbitDisplayApiUrl"] = "${FEATBIT_DISPLAY_API_URL}";
  window["env"]["featbitDisplayEvalUrl"] = "${FEATBIT_DISPLAY_EVAL_URL}";
})(this);
