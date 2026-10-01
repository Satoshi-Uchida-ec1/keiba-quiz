import { describe, expect, it } from "vitest";
import { buildReportUrl } from "./report.ts";

describe("buildReportUrl", () => {
  it("フォームが未設定なら null", () => {
    expect(buildReportUrl("g2-0001", "")).toBeNull();
  });

  it("問題IDを差し込む", () => {
    expect(buildReportUrl("g2-0001", "https://example.com/form?entry.1=__QUESTION_ID__")).toBe(
      "https://example.com/form?entry.1=g2-0001",
    );
  });
});
