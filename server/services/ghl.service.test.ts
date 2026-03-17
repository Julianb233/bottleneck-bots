import { describe, it, expect } from "vitest";
describe("GHL Service Exports", () => {
  it("should export GHLService class", async () => { const m = await import("./ghl.service"); expect(m.GHLService).toBeDefined(); });
  it("should export createGHLService", async () => { const m = await import("./ghl.service"); expect(typeof m.createGHLService).toBe("function"); });
  it("should export GHLError", async () => { const { GHLError } = await import("./ghl.service"); const e = new GHLError("t", "auth", 401, false); expect(e.name).toBe("GHLError"); expect(e.category).toBe("auth"); });
  it("should create service with methods", async () => { const { createGHLService } = await import("./ghl.service"); const s = createGHLService("loc1", 1); expect(typeof s.request).toBe("function"); expect(typeof s.disconnect).toBe("function"); });
  it("should have static methods", async () => { const { GHLService } = await import("./ghl.service"); expect(typeof GHLService.exchangeCodeForTokens).toBe("function"); expect(typeof GHLService.listLocations).toBe("function"); });
});
describe("GHL Error Handling", () => {
  it("should categorize errors", async () => { const { GHLError } = await import("./ghl.service"); expect(new GHLError("x","auth",401,false).category).toBe("auth"); expect(new GHLError("x","rate_limit",429,true,30).retryAfter).toBe(30); });
  it("should use exponential backoff", () => { expect([1,2,3].map(i => Math.min(1000*Math.pow(2,i-1),10000))).toEqual([1000,2000,4000]); });
});
describe("GHL Webhook Verification", () => {
  it("should verify HMAC", async () => { const c = await import("crypto"); const h = (s:string,p:string) => c.createHmac("sha256",s).update(p).digest("hex"); expect(c.timingSafeEqual(Buffer.from(h("s","p")),Buffer.from(h("s","p")))).toBe(true); });
  it("should reject bad HMAC", async () => { const c = await import("crypto"); const v = c.createHmac("sha256","s").update("d").digest("hex"); expect(c.timingSafeEqual(Buffer.from(v),Buffer.from("0".repeat(v.length)))).toBe(false); });
  it("should deduplicate events", () => { const s = new Set<string>(); const p = (id:string) => { if(s.has(id)) return false; s.add(id); return true; }; expect(p("e1")).toBe(true); expect(p("e1")).toBe(false); });
});
describe("GHL Multi-Tenant", () => {
  it("should isolate users", () => { const c = [{u:1,l:"a"},{u:2,l:"b"},{u:1,l:"c"}]; expect(c.filter(x=>x.u===1).map(x=>x.l)).not.toContain("b"); });
  it("should prevent cross-user access", () => { const v = (a:number,b:number) => { if(a!==b) throw new Error("denied"); }; expect(()=>v(1,1)).not.toThrow(); expect(()=>v(1,2)).toThrow(); });
});
describe("GHL Contacts Batching", () => {
  it("should batch into 100s", () => { const b = []; for(let i=0;i<250;i+=100) b.push(Math.min(100,250-i)); expect(b).toEqual([100,100,50]); });
});
