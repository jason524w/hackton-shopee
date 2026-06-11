/**
 * Map a target URL to a platform key used to scope rate limits, circuit breakers, proxy
 * affinity, and sessions. Unknown hosts fall back to their hostname so they're still keyed
 * distinctly rather than colliding under a single bucket.
 */
export function platformOf(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  if (/(^|\.)1688\.com$/.test(hostname)) return "1688";
  if (/(^|\.)taobao\.com$/.test(hostname) || /(^|\.)tmall\.com$/.test(hostname)) return "taobao";
  if (/(^|\.)shopee\./.test(hostname)) return "shopee";
  if (/(^|\.)lazada\./.test(hostname)) return "lazada";
  return hostname;
}
