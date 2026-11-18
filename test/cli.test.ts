import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOptions, parseUrl } from "../src/cli.ts";

describe("parseOptions", () => {
  it("uses defaults when only a URL is given", () => {
    assert.deepEqual(parseOptions(["https://example.com/img.jpg"]), {
      url: "https://example.com/img.jpg",
      count: 10,
      timeoutMs: 30_000,
    });
  });

  it("reads --count and --timeout (long and short forms)", () => {
    assert.deepEqual(parseOptions(["http://example.com", "--count", "3", "-t", "500"]), {
      url: "http://example.com/",
      count: 3,
      timeoutMs: 500,
    });
    assert.equal(parseOptions(["http://example.com", "-n", "5"])?.count, 5);
  });

  it("returns null when help is requested", () => {
    assert.equal(parseOptions(["--help"]), null);
    assert.equal(parseOptions(["-h", "http://example.com"]), null);
  });

  it("leaves the URL undefined when it is not passed", () => {
    assert.equal(parseOptions([])?.url, undefined);
    assert.equal(parseOptions(["-n", "3"])?.url, undefined);
  });

  it("rejects an invalid or non-http URL", () => {
    assert.throws(() => parseOptions(["not a url"]), /invalid URL/);
    assert.throws(() => parseOptions(["ftp://example.com"]), /only http and https/);
  });

  it("rejects non-positive or non-integer numbers", () => {
    for (const bad of ["0", "-1", "1.5", "abc"]) {
      assert.throws(
        () => parseOptions(["http://example.com", `--count=${bad}`]),
        /--count must be/,
      );
    }
    assert.throws(() => parseOptions(["http://example.com", "-t", "0"]), /--timeout must be/);
  });

  it("rejects a timeout too large for Node timers", () => {
    assert.equal(
      parseOptions(["http://example.com", "-t", "2147483647"])?.timeoutMs,
      2_147_483_647,
    );
    assert.throws(
      () => parseOptions(["http://example.com", "-t", "2147483648"]),
      /--timeout must be at most 2147483647/,
    );
  });

  it("rejects more than one URL", () => {
    assert.throws(
      () => parseOptions(["http://a.example", "http://b.example"]),
      /expected one URL, got 2 arguments/,
    );
  });

  it("rejects unknown flags", () => {
    assert.throws(() => parseOptions(["http://example.com", "--foo"]));
  });
});

describe("parseUrl", () => {
  it("accepts http(s) URLs and trims spaces around them", () => {
    assert.equal(parseUrl("  https://example.com/a.jpg  "), "https://example.com/a.jpg");
    assert.equal(parseUrl("http://example.com"), "http://example.com/");
  });

  it("rejects empty, invalid and non-http input", () => {
    assert.throws(() => parseUrl(""), /URL is required/);
    assert.throws(() => parseUrl("   "), /URL is required/);
    assert.throws(() => parseUrl("example.com"), /invalid URL/);
    assert.throws(() => parseUrl("file:///etc/passwd"), /only http and https/);
  });
});
