import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { createChromeBrowserRetrievalProvider, type BrowserController } from "../index";

/** Decode a percent-encoded GBK keyword back to a string (independent oracle). */
function decodeGbkKeyword(keywordsParam: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < keywordsParam.length; i += 1) {
    if (keywordsParam[i] === "%") {
      bytes.push(parseInt(keywordsParam.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(keywordsParam.charCodeAt(i));
    }
  }
  return iconv.decode(Buffer.from(bytes), "gbk");
}

function controllerCapturingUrls(urls: string[]): BrowserController {
  return {
    async capture(input) {
      urls.push(input.url);
      // Return one parseable 1688 row so extract1688Search doesn't throw on empty.
      return {
        url: input.url,
        title: "1688搜索",
        text: ["桌面吸尘器手持清洁器USB充电", "¥12.80"].join("\n"),
        links: [],
        captured_at: "2026-06-06T00:00:00.000Z",
      };
    },
  };
}

describe("1688 GBK keyword encoding", () => {
  it("GBK-encodes an arbitrary Chinese query that was never hardcoded (round-trips)", async () => {
    const urls: string[] = [];
    const provider = createChromeBrowserRetrievalProvider(controllerCapturingUrls(urls), {
      allowedDomains: ["1688.com"],
      maxSteps: 1,
    });

    const query = "瑜伽垫"; // yoga mat — NOT in the old 2-entry hardcoded map
    await provider.extract1688Search({ query, limit: 3 });

    expect(urls).toHaveLength(1);
    const match = urls[0].match(/keywords=([^&]+)/);
    expect(match).not.toBeNull();
    const keywordsParam = match![1];
    // Must be GBK bytes, not UTF-8: decoding as GBK yields the original query.
    expect(decodeGbkKeyword(keywordsParam)).toBe(query);
    // And it must NOT be the UTF-8 percent-encoding (which GBK decode would garble).
    expect(keywordsParam).not.toBe(encodeURIComponent(query));
  });

  it("still produces the known GBK encoding for the original demo query", async () => {
    const urls: string[] = [];
    const provider = createChromeBrowserRetrievalProvider(controllerCapturingUrls(urls), {
      allowedDomains: ["1688.com"],
      maxSteps: 1,
    });

    await provider.extract1688Search({ query: "桌面吸尘器", limit: 3 });

    const keywordsParam = urls[0].match(/keywords=([^&]+)/)![1];
    expect(keywordsParam).toBe("%D7%C0%C3%E6%CE%FC%B3%BE%C6%F7");
  });
});
