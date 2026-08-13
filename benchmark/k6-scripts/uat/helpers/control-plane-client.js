import http from 'k6/http';

export class ControlPlaneClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  pushFullSync() {
    const res = http.post(
      `${this.baseUrl}/api/admin/push-eval-full-sync`,
      null,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        timeout: '15s',
      }
    );

    const result = { _status: res.status, _body: res.body };
    if (res.status >= 200 && res.status < 300 && res.body) {
      try {
        Object.assign(result, JSON.parse(res.body));
      } catch (e) {
        result._parseError = e.message;
      }
    }
    return result;
  }

  /**
   * GET /api/admin/connections — returns all active connections from Redis.
   * Response shape: { success: true, data: [{ id, envId, secret }] }
   */
  getConnections() {
    const res = http.get(
      `${this.baseUrl}/api/admin/connections`,
      {
        headers: {
          'X-API-Key': this.apiKey,
        },
        timeout: '15s',
      }
    );

    const result = { _status: res.status, _body: res.body };
    if (res.status >= 200 && res.status < 300 && res.body) {
      try {
        Object.assign(result, JSON.parse(res.body));
      } catch (e) {
        result._parseError = e.message;
      }
    }
    return result;
  }
}
