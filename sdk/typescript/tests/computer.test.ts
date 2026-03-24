import { describe, it, expect, vi, beforeEach } from "vitest";
import { Computer } from "../src/computer.js";
import type { OrgoClient } from "../src/client.js";

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as OrgoClient;
}

const mockData: Record<string, unknown> = {
  id: "comp-1",
  status: "running",
  specs: { cpu: 4, ram: 8192 },
  vncUrl: "vnc://host:5900",
  novncUrl: "https://host/novnc",
};

describe("Computer", () => {
  let client: ReturnType<typeof createMockClient>;
  let computer: Computer;

  beforeEach(() => {
    client = createMockClient();
    computer = new Computer(client as unknown as OrgoClient, mockData);
  });

  it("exposes id, status, specs, vncUrl, novncUrl", () => {
    expect(computer.id).toBe("comp-1");
    expect(computer.status).toBe("running");
    expect(computer.specs).toEqual({ cpu: 4, ram: 8192 });
    expect(computer.vncUrl).toBe("vnc://host:5900");
    expect(computer.novncUrl).toBe("https://host/novnc");
  });

  it("vncUrl is null when not running", () => {
    const stopped = new Computer(client as unknown as OrgoClient, { ...mockData, status: "stopped" });
    expect(stopped.vncUrl).toBeNull();
    expect(stopped.novncUrl).toBeNull();
  });

  it("click sends POST to /click", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.click(100, 200);
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/click",
      { x: 100, y: 200 },
    );
  });

  it("rightClick sends POST to /right-click", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.rightClick(50, 75);
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/right-click",
      { x: 50, y: 75 },
    );
  });

  it("doubleClick sends POST to /double-click", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.doubleClick(10, 20);
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/double-click",
      { x: 10, y: 20 },
    );
  });

  it("type sends text", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.type("hello");
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/type",
      { text: "hello" },
    );
  });

  it("key sends key combo", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.key("Enter");
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/key",
      { key: "Enter" },
    );
  });

  it("bash executes command and normalizes result", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { stdout: "hi\n", stderr: "", exit_code: 0, duration_ms: 50 },
    });
    const result = await computer.bash("echo hi");
    expect(result).toEqual({ stdout: "hi\n", stderr: "", exitCode: 0, durationMs: 50 });
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/bash",
      { command: "echo hi", timeout: undefined },
    );
  });

  it("exec sends code and language", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { stdout: "42\n", stderr: "", exit_code: 0, duration_ms: 100 },
    });
    const result = await computer.exec("print(42)", { language: "python" });
    expect(result).toEqual({ stdout: "42\n", stderr: "", exitCode: 0, durationMs: 100 });
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/exec",
      { code: "print(42)", language: "python" },
    );
  });

  it("scroll sends x, y, and scroll opts", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.scroll(100, 200, { direction: "down", amount: 3 });
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/scroll",
      { x: 100, y: 200, direction: "down", amount: 3 },
    );
  });

  it("drag sends start/end coordinates", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.drag(0, 0, 100, 100);
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/drag",
      { start_x: 0, start_y: 0, end_x: 100, end_y: 100 },
    );
  });

  it("clipboardRead returns text", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { text: "copied" } });
    const result = await computer.clipboardRead();
    expect(result).toBe("copied");
  });

  it("clipboardWrite sends text", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await computer.clipboardWrite("paste this");
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/clipboard",
      { text: "paste this" },
    );
  });

  it("actions sends batch wrapped in { actions }", async () => {
    const results = [{ action: "click", success: true, duration_ms: 10 }];
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ results });
    const r = await computer.actions([{ action: "click", params: { x: 1, y: 2 } }]);
    expect(r).toEqual(results);
    expect(client.post).toHaveBeenCalledWith(
      "/computers/comp-1/actions",
      { actions: [{ action: "click", params: { x: 1, y: 2 } }] },
    );
  });

  it("start/stop/destroy call correct endpoints", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (client.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await computer.start();
    expect(computer.status).toBe("starting");
    expect(client.post).toHaveBeenCalledWith("/computers/comp-1/start");

    await computer.stop();
    expect(computer.status).toBe("stopping");
    expect(client.post).toHaveBeenCalledWith("/computers/comp-1/stop");

    await computer.destroy();
    expect(client.delete).toHaveBeenCalledWith("/computers/comp-1");
  });

  it("refresh updates status and specs", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      computer: { status: "stopped", specs: { cpu: 2, ram: 4096 } },
    });
    await computer.refresh();
    expect(computer.status).toBe("stopped");
    expect(computer.specs).toEqual({ cpu: 2, ram: 4096 });
  });
});
