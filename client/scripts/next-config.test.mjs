import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const configPath = new URL("../next.config.ts", import.meta.url).pathname;

function loadConfig({ nodeEnv, backendUrl }) {
  const childEnv = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: nodeEnv,
  };

  if (backendUrl !== undefined) childEnv.BACKEND_URL = backendUrl;

  const script = `
    import config from ${JSON.stringify(configPath)};
    const rewrites = await config.rewrites();
    const headers = await config.headers();
    console.log(JSON.stringify({
      rewrites,
      headers,
      remotePattern: config.images.remotePatterns[0],
    }));
  `;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    env: childEnv,
    encoding: "utf8",
  });

  return {
    ...result,
    output: result.stdout.trim(),
    errorOutput: result.stderr.trim(),
  };
}

function assertConfigLoads(options) {
  const result = loadConfig(options);
  assert.equal(result.status, 0, result.errorOutput);
  return JSON.parse(result.output);
}

function assertConfigFails(options) {
  const result = loadConfig(options);
  assert.notEqual(result.status, 0, "expected config loading to fail");
  return result.errorOutput;
}

test("production config fails when BACKEND_URL is missing", () => {
  const error = assertConfigFails({ nodeEnv: "production" });
  assert.match(error, /BACKEND_URL/);
  assert.match(error, /required in production/);
  assert.doesNotMatch(error, /elite-drive-api-eq4iwb3wxa-as\.a\.run\.app/);
});

test("production config fails when BACKEND_URL is empty", () => {
  const error = assertConfigFails({ nodeEnv: "production", backendUrl: "" });
  assert.match(error, /BACKEND_URL is required in production/);
});

test("production config fails when BACKEND_URL is whitespace-only", () => {
  const error = assertConfigFails({ nodeEnv: "production", backendUrl: "   " });
  assert.match(error, /BACKEND_URL is required in production/);
});

test("production config uses a valid BACKEND_URL for derived config", () => {
  const config = assertConfigLoads({ nodeEnv: "production", backendUrl: " https://api.example.test " });
  assert.deepEqual(config.rewrites, [{ source: "/api/:path*", destination: "https://api.example.test/api/:path*" }]);
  assert.equal(config.remotePattern.protocol, "https");
  assert.equal(config.remotePattern.hostname, "api.example.test");
  assert.equal(config.remotePattern.pathname, "/**");
  assert.match(config.headers[0].headers[0].value, /https:\/\/api\.example\.test/);
});

test("development config falls back to localhost when BACKEND_URL is missing", () => {
  const config = assertConfigLoads({ nodeEnv: "development" });
  assert.deepEqual(config.rewrites, [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }]);
});

test("config fails for an invalid BACKEND_URL without falling back", () => {
  const error = assertConfigFails({ nodeEnv: "production", backendUrl: "not-a-url" });
  assert.match(error, /Invalid URL|BACKEND_URL/);
  assert.doesNotMatch(error, /localhost:8000|elite-drive-api-eq4iwb3wxa-as\.a\.run\.app/);
});
