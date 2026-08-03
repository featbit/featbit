import { describe, expect, it } from "vitest"
import { resolveSdkEndpoints } from "./sdk-endpoints"

describe("resolveSdkEndpoints", () => {
  it("prefers display URLs and derives the streaming protocol", () => {
    expect(
      resolveSdkEndpoints({
        apiUrl: "http://internal-api:5000",
        evaluationUrl: "http://internal-evaluation:5100",
        displayApiUrl: " https://api.example.com ",
        displayEvaluationUrl: " https://evaluation.example.com ",
      })
    ).toEqual([
      {
        id: "streamingUrl",
        value: "wss://evaluation.example.com",
      },
      {
        id: "eventUrl",
        value: "https://evaluation.example.com",
      },
      {
        id: "openApiEndpoint",
        value: "https://api.example.com",
      },
    ])
  })

  it("falls back to service URLs and preserves missing evaluation endpoints", () => {
    expect(
      resolveSdkEndpoints({
        apiUrl: "http://localhost:5000",
        evaluationUrl: "",
        displayApiUrl: "",
        displayEvaluationUrl: "",
      })
    ).toEqual([
      { id: "streamingUrl", value: "" },
      { id: "eventUrl", value: "" },
      { id: "openApiEndpoint", value: "http://localhost:5000" },
    ])
  })
})
