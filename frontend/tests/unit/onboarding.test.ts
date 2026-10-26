import { beforeEach, expect, it, vi } from "vitest";
import { parseOnboarding } from "@/lib/onboarding";
const { apiRequest, getUser } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
import { completeAuthHandoff, saveOnboarding } from "@/actions/onboarding";
const complete = { version: 1, step: 2, completed: true };
const incomplete = { version: 1, step: 1, completed: false };
beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "a", phone_confirmed_at: "today" } },
    error: null,
  });
  apiRequest.mockResolvedValue(incomplete);
});
it.each([
  null,
  "broken",
  "null",
  "[]",
  { ...complete, step: 1.5 },
  { ...complete, step: -1 },
  { ...complete, step: "1" },
  { ...complete, step: 3 },
  { ...complete, version: 0 },
  { ...complete, completed: "true" },
])("ignores malformed progress %j", (value) => {
  expect(parseOnboarding(value)).toBeNull();
});
it("accepts only supported progress fields", () => {
  expect(
    parseOnboarding(JSON.stringify({ ...complete, user_id: "forged" })),
  ).toEqual(complete);
});
it("never resets completed account onboarding", async () => {
  apiRequest.mockResolvedValue(complete);
  expect(await saveOnboarding(incomplete)).toBe(true);
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("saves anonymous completion to the verified current account", async () => {
  expect(await completeAuthHandoff(complete, "/portfolio")).toEqual({
    destination: "/portfolio",
    completed: true,
  });
  expect(apiRequest).toHaveBeenLastCalledWith("/api/v1/onboarding", {
    method: "PATCH",
    body: JSON.stringify(complete),
  });
});
it("resumes onboarding when neither account nor browser completed it", async () => {
  expect(await completeAuthHandoff(incomplete, "/portfolio")).toEqual({
    destination: "/onboarding?next=%2Fportfolio",
  });
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("continues completed accounts without writing browser progress", async () => {
  apiRequest.mockResolvedValue(complete);
  expect(await completeAuthHandoff(null, "//unsafe.example")).toEqual({
    destination: "/market",
    completed: true,
  });
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("requires verification before reading or saving progress", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "a" } }, error: null });
  expect(await completeAuthHandoff(complete, "/portfolio")).toEqual({
    destination: "/login?verify=1&next=%2Fportfolio",
  });
  expect(apiRequest).not.toHaveBeenCalled();
});
it.each(["read", "write"])(
  "keeps service %s failures retryable",
  async (stage) => {
    if (stage === "write") apiRequest.mockResolvedValueOnce(incomplete);
    apiRequest.mockRejectedValue(new Error("unavailable"));
    const result = await completeAuthHandoff(complete, "/market");
    expect(result.error).toContain("try again");
    expect(result.destination).toBeUndefined();
  },
);
