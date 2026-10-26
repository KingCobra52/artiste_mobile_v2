import { expect, type Page } from "@playwright/test";
import axe from "axe-core";
export async function expectAccessible(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: typeof axe }).axe.run(
      document,
      {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      },
    );
    return result.violations.map((item) => ({
      rule: item.id,
      help: item.help,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    }));
  });
  expect(violations, `Accessibility violations at ${page.url()}`).toEqual([]);
}
