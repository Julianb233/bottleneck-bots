import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrgoClient } from "../src/client.js";
import { AuthenticationError, RateLimitError, ServerError } from "../src/errors.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function errorResponse(message: string, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("OrgoClient", () => {
  let client: OrgoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OrgoClient({
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
    });
  });

  it("sends GET requests with auth header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "123" }));

    const result = await client.get<{ id: string }>("/v1/test");

    expect(result).toEqual({ id: "123" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/v1/test",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("sends POST requests with body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.post("/v1/test", { name: "foo" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/v1/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "foo" }),
      }),
    );
  });

  it("handles 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await client.delete("/v1/test/123");

    expect(result).toBeUndefined();
  });

  it("throws AuthenticationError on 401", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Unauthorized", 401));

    await expect(client.get("/v1/test")).rejects.toThrow(AuthenticationError);
  });

  it("throws RateLimitError on 429 with retryAfter", async () => {
    mockFetch.mockResolvedValue(
      errorResponse("Too many requests", 429, { "retry-after": "30" }),
    );

    await expect(client.get("/v1/test")).rejects.toThrow(RateLimitError);
  });

  it("retries on 500 errors", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse("Server error", 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await client.get<{ ok: boolean }>("/v1/test");

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws ServerError after exhausting retries", async () => {
    mockFetch.mockResolvedValue(errorResponse("Server error", 500));

    await expect(client.get("/v1/test")).rejects.toThrow(ServerError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("strips trailing slash from baseUrl", () => {
    const c = new OrgoClient({ apiKey: "k", baseUrl: "https://api.test.com/" });
    expect(c.baseUrl).toBe("https://api.test.com");
  });
});
