import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { measureRequest } from "../src/measure.ts";

const BODY_SIZE = 256 * 1024;

describe("measureRequest", () => {
  let server: Server;
  let baseUrl: string;
  let lastHeaders: IncomingHttpHeaders = {};

  before(async () => {
    server = createServer((req, res) => {
      lastHeaders = req.headers;
      if (req.url === "/not-found") {
        res.writeHead(404).end();
      } else if (req.url === "/sized") {
        res.writeHead(200, { "Content-Length": BODY_SIZE });
        res.write(Buffer.alloc(BODY_SIZE / 2));
        res.end(Buffer.alloc(BODY_SIZE / 2));
      } else if (req.url === "/gzip") {
        // Misbehaving server: compresses even though we asked for "identity".
        const body = gzipSync(Buffer.alloc(BODY_SIZE));
        res.writeHead(200, { "Content-Encoding": "gzip", "Content-Length": body.length });
        res.end(body);
      } else if (req.url === "/slow-body") {
        res.writeHead(200, { "Content-Length": 4 });
        setTimeout(() => res.end("late"), 500);
      } else if (req.url === "/slow") {
        setTimeout(() => res.end("late"), 500);
      } else {
        // Send the body in two chunks to check that all chunks are counted.
        res.write(Buffer.alloc(BODY_SIZE / 2));
        res.end(Buffer.alloc(BODY_SIZE / 2));
      }
    });
    server.listen(0); // 0 = any free port
    await once(server, "listening");
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  it("downloads the whole body and measures the time", async () => {
    const result = await measureRequest(`${baseUrl}/file`, 5000);

    assert.equal(result.bytes, BODY_SIZE);
    assert.ok(result.durationMs > 0);
    assert.equal(result.compressed, false);
  });

  it("asks for an uncached, uncompressed response", async () => {
    await measureRequest(`${baseUrl}/file`, 5000);

    assert.equal(lastHeaders["cache-control"], "no-cache");
    assert.equal(lastHeaders["accept-encoding"], "identity");
  });

  it("reports progress with the total size from Content-Length", async () => {
    const calls: Array<[number, number | undefined]> = [];
    await measureRequest(`${baseUrl}/sized`, 5000, (bytes, total) => calls.push([bytes, total]));

    assert.deepEqual(calls[0], [0, BODY_SIZE]);
    assert.deepEqual(calls.at(-1), [BODY_SIZE, BODY_SIZE]);
    // Bytes only grow.
    assert.ok(calls.every(([bytes], i) => i === 0 || bytes >= calls[i - 1][0]));
  });

  it("reports an unknown total for chunked responses", async () => {
    const totals = new Set<number | undefined>();
    await measureRequest(`${baseUrl}/file`, 5000, (_bytes, total) => totals.add(total));

    assert.deepEqual([...totals], [undefined]);
  });

  it("throws on a non-2xx status", async () => {
    await assert.rejects(measureRequest(`${baseUrl}/not-found`, 5000), /HTTP 404/);
  });

  it("flags a compressed response and does not trust its Content-Length", async () => {
    const totals = new Set<number | undefined>();
    const result = await measureRequest(`${baseUrl}/gzip`, 5000, (_b, total) => totals.add(total));

    assert.equal(result.compressed, true);
    assert.equal(result.bytes, BODY_SIZE); // decompressed size
    assert.deepEqual([...totals], [undefined]);
  });

  it("times out while waiting for headers", async () => {
    await assert.rejects(measureRequest(`${baseUrl}/slow`, 50), /request timed out after 50 ms/);
  });

  it("times out while reading the body", async () => {
    await assert.rejects(
      measureRequest(`${baseUrl}/slow-body`, 50),
      /request timed out after 50 ms/,
    );
  });
});
