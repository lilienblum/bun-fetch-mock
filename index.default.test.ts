import { beforeEach, describe, expect, test } from "bun:test";
import { useFetchMock } from "./index";

describe("bun-fetch-mock (default options)", () => {
	const fetchMock = useFetchMock();

	beforeEach(() => {
		fetchMock.reset();
	});

	test("Supports path mocks without baseUrl", async () => {
		fetchMock.get("/status", { data: { ok: true } });

		const response = await fetch("/status");
		const data = await response.json();

		expect(data).toEqual({ ok: true });
		fetchMock.assertAllMocksUsed();
	});

	test("Shows path mocks in unmocked request errors", async () => {
		fetchMock.get("/users", { data: [] });

		await expect(fetch("/unknown")).rejects.toThrow(
			"No mock found for [GET] /unknown. Available mocks: [GET] /users",
		);
	});
});
