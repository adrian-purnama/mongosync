import { afterEach, describe, expect, it, vi } from "vitest";

const requireMasterPasswordMock = vi.fn();
const getCopyJobMock = vi.fn();
const loadExportArtifactMock = vi.fn();

vi.mock("@/src/server/auth/auth-guard", () => ({
  requireMasterPassword: requireMasterPasswordMock,
}));

vi.mock("@/src/server/mongo/copy-job-store", () => ({
  getCopyJob: getCopyJobMock,
}));

vi.mock("@/src/server/mongo/export-service", () => ({
  loadExportArtifact: loadExportArtifactMock,
}));

describe("export download route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the saved ZIP for completed export jobs", async () => {
    requireMasterPasswordMock.mockResolvedValue("master-password");
    getCopyJobMock.mockResolvedValue({
      id: "job-1",
      kind: "export",
      status: "completed",
      resultAvailable: true,
      artifactContentType: "application/zip",
      artifactFileName: "source-db.zip",
    });
    loadExportArtifactMock.mockResolvedValue({
      fileName: "source-db.zip",
      contentType: "application/zip",
      content: Buffer.from("zip-binary"),
    });

    const { GET } = await import("@/app/api/export/jobs/[id]/download/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toContain("source-db.zip");
    expect(await response.text()).toBe("zip-binary");
  });

  it("rejects downloads for incomplete export jobs", async () => {
    requireMasterPasswordMock.mockResolvedValue("master-password");
    getCopyJobMock.mockResolvedValue({
      id: "job-2",
      kind: "export",
      status: "running",
      resultAvailable: false,
    });

    const { GET } = await import("@/app/api/export/jobs/[id]/download/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "job-2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Export artifact is not ready yet.");
  });
});
