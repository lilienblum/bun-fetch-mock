# bun-fetch-mock

[![npm version](https://badge.fury.io/js/bun-fetch-mock.svg)](https://www.npmjs.com/package/bun-fetch-mock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Dead simple fetch mocking for Bun tests.

## Install

```bash
bun add -d bun-fetch-mock
```

## Usage

Initialize `useFetchMock()` inside `describe(...)`, not inside `test(...)`.

```ts
import { describe, test, expect } from "bun:test";
import { useFetchMock } from "bun-fetch-mock";

describe("api", () => {
  const fetchMock = useFetchMock({ baseUrl: "https://api.example.com" });

  test("mocks fetch", async () => {
    fetchMock
      .get("/users/1", { data: { id: 1, name: "Ada" }, once: true })
      .get("/users/1", { status: 404, data: { error: "Not found" } });

    const okRes = await fetch("https://api.example.com/users/1");
    expect(await okRes.json()).toEqual({ id: 1, name: "Ada" });

    const notFoundRes = await fetch("https://api.example.com/users/1");
    expect(notFoundRes.status).toBe(404);

    // Fails the test if any configured mock was not called.
    fetchMock.assertAllMocksUsed();
  });
});
```

## Dev

```bash
bun run test
bun run test:coverage
bun run type-check
```

## License

MIT
