import { describe, expect, it } from "vitest";
import { isWebKitSameOriginRscCancellation } from "../e2e/page-errors";

const cancellation =
  "/localhost:3000/onboarding?replay=1&_rsc=7f6jv0pvcMveJMic due to access control checks.";

describe("WebKit page errors", () => {
  it("recognizes the exact same-origin RSC cancellation diagnostic", () => {
    expect(
      isWebKitSameOriginRscCancellation({
        message: cancellation,
        browserName: "webkit",
        baseURL: "http://localhost:3000",
      }),
    ).toBe(true);
    expect(
      isWebKitSameOriginRscCancellation({
        message:
          "/127.0.0.1:3102/market?_rsc=abc due to access control checks.",
        browserName: "webkit",
        baseURL: "http://127.0.0.1:3102",
      }),
    ).toBe(true);
  });

  it.each([
    ["another browser", cancellation, "chromium", "http://localhost:3000"],
    [
      "another origin",
      cancellation,
      "webkit",
      "http://127.0.0.1:3000",
    ],
    [
      "a non-RSC request",
      "/localhost:3000/market due to access control checks.",
      "webkit",
      "http://localhost:3000",
    ],
    [
      "an empty RSC value",
      "/localhost:3000/market?_rsc= due to access control checks.",
      "webkit",
      "http://localhost:3000",
    ],
    [
      "a hydration error",
      "Hydration failed because the server rendered HTML did not match the client.",
      "webkit",
      "http://localhost:3000",
    ],
  ])("does not suppress %s", (_case, message, browserName, baseURL) => {
    expect(
      isWebKitSameOriginRscCancellation({ message, browserName, baseURL }),
    ).toBe(false);
  });
});
