import http from 'k6/http';

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export class TestAppClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  health() {
    const res = http.get(`${this.baseUrl}/api/health`);
    return this._parse(res);
  }

  connect() {
    const res = http.post(`${this.baseUrl}/api/connect`, null, {
      headers: { 'Content-Type': 'application/json' },
      timeout: '45s',
    });
    return this._parse(res);
  }

  disconnect() {
    const res = http.post(`${this.baseUrl}/api/disconnect`, null, JSON_HEADERS);
    return this._parse(res);
  }

  status() {
    const res = http.get(`${this.baseUrl}/api/status`);
    return this._parse(res);
  }

  events() {
    const res = http.get(`${this.baseUrl}/api/events`);
    return this._parse(res);
  }

  _parse(res) {
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
