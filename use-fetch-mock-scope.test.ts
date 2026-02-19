import { describe, expect, test } from "bun:test";
import { useFetchMock } from "./index";

describe("useFetchMock scope guard", () => {
	test("Throws a clear error when called inside test()", () => {
		expect(() => useFetchMock()).toThrow(
			"useFetchMock() must be called at module scope or inside describe(), not inside test().",
		);
	});
});
