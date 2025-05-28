import { check } from 'k6';
import http from 'k6/http';

export default function () {
  const payload = [
    {
      user: {
        keyId: "k6-tester",
        name: "K6 Tester",
        customizedProperties: [
          {
            name: "location",
            value: "127.0.0.1",
          },
          {
            name: "email",
            value: "k6-tester@k6.com",
          }
        ]
      },
      variations: [],
      metrics: []
    }
  ];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'yx0cZZfUVEqHgYAC_oyjkQ4XBf-3CMq0O9MoHMBdrubw'
  };

  const res = http.post(
    'http://localhost:5100/api/public/insight/track',
    JSON.stringify(payload),
    { headers: headers }
  );

  check(res, {
    'is status 200': (r) => r.status === 200,
  });
}