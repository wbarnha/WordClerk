import { toSafeHyperlinkUrl, toSafeHtml } from "openclerk-core";
import { insertSafeHyperlink, insertSafeComment } from "../src/taskpane/safeInsertion";

// Word.InsertLocation.replace is a real Office.js global normally supplied by the WebView host at
// runtime -- it has no presence under Jest's node testEnvironment. safeInsertion.ts's dispatch
// logic references it directly (matching the pre-existing word.ts code being ported), so tests
// exercising that dispatch need a minimal stand-in, not a mocking framework.
(global as any).Word = { InsertLocation: { replace: "Replace" } };

describe("toSafeHyperlinkUrl", () => {
  test("rejects an unsafe scheme", () => {
    expect(toSafeHyperlinkUrl("javascript:alert(1)")).toBeNull();
  });

  test("accepts an https URL", () => {
    expect(toSafeHyperlinkUrl("https://example.com")).toBe("https://example.com");
  });
});

describe("insertSafeHyperlink dispatch", () => {
  const url = toSafeHyperlinkUrl("https://example.com")!;
  const text = toSafeHtml("Smith v. Jones");

  test("calls only insertHyperlink when all three duck-typed methods are present", async () => {
    const insertHyperlink = jest.fn();
    const insertHtml = jest.fn();
    const insertText = jest.fn();
    const item = { insertHyperlink, insertHtml, insertText };
    const context = { sync: jest.fn().mockResolvedValue(undefined) };

    await insertSafeHyperlink(context as any, item as any, url, text);

    expect(insertHyperlink).toHaveBeenCalledTimes(1);
    expect(insertHtml).not.toHaveBeenCalled();
    expect(insertText).not.toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalledTimes(1);
  });

  test("calls only insertHtml when insertHyperlink is unavailable", async () => {
    const insertHtml = jest.fn();
    const insertText = jest.fn();
    const item = { insertHtml, insertText };
    const context = { sync: jest.fn().mockResolvedValue(undefined) };

    await insertSafeHyperlink(context as any, item as any, url, text);

    expect(insertHtml).toHaveBeenCalledTimes(1);
    expect(insertText).not.toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalledTimes(1);
  });

  test("calls only insertText when neither insertHyperlink nor insertHtml is available", async () => {
    const insertText = jest.fn();
    const item = { insertText };
    const context = { sync: jest.fn().mockResolvedValue(undefined) };

    await insertSafeHyperlink(context as any, item as any, url, text);

    expect(insertText).toHaveBeenCalledTimes(1);
    expect(context.sync).toHaveBeenCalledTimes(1);
  });
});

describe("insertSafeComment", () => {
  test("calls insertComment with the branded text and syncs exactly once", async () => {
    const text = toSafeHtml("An excerpt of the cited opinion.");
    const insertComment = jest.fn();
    const range = { insertComment };
    const context = { sync: jest.fn().mockResolvedValue(undefined) };

    await insertSafeComment(context as any, range as any, text);

    expect(insertComment).toHaveBeenCalledWith(text);
    expect(context.sync).toHaveBeenCalledTimes(1);
  });
});
