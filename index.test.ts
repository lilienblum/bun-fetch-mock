import { describe, expect, test } from "bun:test";
import { useFetchMock, type UrlOrPath } from "./index";

describe("bun-fetch-mock", () => {
	describe("Basic HTTP methods", () => {
		test("GET request with JSON response", async () => {
			const fetchMock = useFetchMock();
			const testData = { id: 1, name: "John Doe" };

			fetchMock.get("https://api.example.com/users/1", {
				data: testData,
			});

			const response = await fetch("https://api.example.com/users/1");
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual(testData);
			fetchMock.assertAllMocksUsed();
		});

		test("POST request with custom status", async () => {
			const fetchMock = useFetchMock();
			const newUser = { id: 2, name: "Jane Doe" };

			fetchMock.post("https://api.example.com/users", {
				data: newUser,
				status: 201,
				statusText: "Created",
			});

			const response = await fetch("https://api.example.com/users", {
				method: "POST",
				body: JSON.stringify({ name: "Jane Doe" }),
			});
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(response.statusText).toBe("Created");
			expect(data).toEqual(newUser);
			fetchMock.assertAllMocksUsed();
		});

		test("PUT request", async () => {
			const fetchMock = useFetchMock();
			const updatedUser = { id: 1, name: "John Smith" };

			fetchMock.put("https://api.example.com/users/1", {
				data: updatedUser,
			});

			const response = await fetch("https://api.example.com/users/1", {
				method: "PUT",
				body: JSON.stringify(updatedUser),
			});
			const data = await response.json();

			expect(data).toEqual(updatedUser);
			fetchMock.assertAllMocksUsed();
		});

		test("DELETE request", async () => {
			const fetchMock = useFetchMock();

			fetchMock.delete("https://api.example.com/users/1", {
				status: 204,
			});

			const response = await fetch("https://api.example.com/users/1", {
				method: "DELETE",
			});

			expect(response.status).toBe(204);
			fetchMock.assertAllMocksUsed();
		});

		test("PATCH request", async () => {
			const fetchMock = useFetchMock();
			const patchData = { name: "John Updated" };

			fetchMock.patch("https://api.example.com/users/1", {
				data: patchData,
			});

			const response = await fetch("https://api.example.com/users/1", {
				method: "PATCH",
				body: JSON.stringify({ name: "John Updated" }),
			});
			const data = await response.json();

			expect(data).toEqual(patchData);
			fetchMock.assertAllMocksUsed();
		});

		test("HEAD request", async () => {
			const fetchMock = useFetchMock();

			fetchMock.head("https://api.example.com/users/1", {
				status: 200,
				headers: { "X-User-Exists": "true" },
			});

			const response = await fetch("https://api.example.com/users/1", {
				method: "HEAD",
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("X-User-Exists")).toBe("true");
			expect(await response.text()).toBe(""); // HEAD should have no body
			fetchMock.assertAllMocksUsed();
		});

		test("OPTIONS request", async () => {
			const fetchMock = useFetchMock();

			fetchMock.options("https://api.example.com/users", {
				status: 200,
				headers: { Allow: "GET, POST, PUT, DELETE" },
			});

			const response = await fetch("https://api.example.com/users", {
				method: "OPTIONS",
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Allow")).toBe("GET, POST, PUT, DELETE");
			fetchMock.assertAllMocksUsed();
		});
	});

	describe("Response handling", () => {
		test("String response", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/health", {
				data: "OK",
			});

			const response = await fetch("https://api.example.com/health");
			const text = await response.text();

			expect(response.headers.get("Content-Type")).toBe("text/plain");
			expect(text).toBe("OK");
			fetchMock.assertAllMocksUsed();
		});

		test("Empty response", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/empty", {
				status: 204,
			});

			const response = await fetch("https://api.example.com/empty");
			const text = await response.text();

			expect(response.status).toBe(204);
			expect(text).toBe("");
			fetchMock.assertAllMocksUsed();
		});

		test("Custom headers", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/data", {
				data: { message: "test" },
				headers: {
					"X-Custom-Header": "custom-value",
					"X-Rate-Limit": "100",
				},
			});

			const response = await fetch("https://api.example.com/data");

			expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
			expect(response.headers.get("X-Rate-Limit")).toBe("100");
			fetchMock.assertAllMocksUsed();
		});
	});

	describe("Base URL support", () => {
		test("Uses base URL for relative paths", async () => {
			const fetchMock = useFetchMock({ baseUrl: "https://api.example.com" });

			fetchMock.get("/users", {
				data: [{ id: 1, name: "John" }],
			});

			const response = await fetch("https://api.example.com/users");
			const data = await response.json();

			expect(data).toEqual([{ id: 1, name: "John" }]);
			fetchMock.assertAllMocksUsed();
		});

		test("Works with absolute URLs even with baseUrl set", async () => {
			const fetchMock = useFetchMock({ baseUrl: "https://api.example.com" });

			fetchMock.get("https://other-api.com/data", {
				data: { source: "other" },
			});

			const response = await fetch("https://other-api.com/data");
			const data = await response.json();

			expect(data).toEqual({ source: "other" });
			fetchMock.assertAllMocksUsed();
		});
	});

	describe("One-time mocks", () => {
		test("Once mock is removed after first use", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/data", {
				data: { count: 1 },
				once: true,
			});

			// First call should work
			const response1 = await fetch("https://api.example.com/data");
			const data1 = await response1.json();
			expect(data1).toEqual({ count: 1 });

			// Second call should fail
			await expect(fetch("https://api.example.com/data")).rejects.toThrow(
				"No mock found for [GET] https://api.example.com/data",
			);
		});

		test("Multiple mocks with same URL", async () => {
			const fetchMock = useFetchMock();

			fetchMock
				.get("https://api.example.com/data", {
					data: { attempt: 1 },
					once: true,
				})
				.get("https://api.example.com/data", {
					data: { attempt: 2 },
				});

			// First call uses the once mock
			const response1 = await fetch("https://api.example.com/data");
			const data1 = await response1.json();
			expect(data1).toEqual({ attempt: 1 });

			// Second call uses the persistent mock
			const response2 = await fetch("https://api.example.com/data");
			const data2 = await response2.json();
			expect(data2).toEqual({ attempt: 2 });
		});
	});

	describe("Error handling", () => {
		test("Throws error for unmocked request", async () => {
			useFetchMock();

			await expect(fetch("https://api.example.com/unknown")).rejects.toThrow(
				"No mock found for [GET] https://api.example.com/unknown",
			);
		});

		test("Throws error for unsupported HTTP method", async () => {
			useFetchMock();

			await expect(
				fetch("https://api.example.com/data", { method: "TRACE" }),
			).rejects.toThrow("Unsupported HTTP method: TRACE");
		});

		test("Validates URL format", () => {
			const fetchMock = useFetchMock();

			expect(() => {
				fetchMock.get("invalid-url" as UrlOrPath);
			}).toThrow(
				"Invalid URL for GET mock: URL must start with http://, https://, or /",
			);
		});

		test("Shows available mocks in error message", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/users", { data: [] });
			fetchMock.post("https://api.example.com/users", { data: {} });

			await expect(fetch("https://api.example.com/unknown")).rejects.toThrow(
				"No mock found for [GET] https://api.example.com/unknown. Available mocks: [GET] https://api.example.com/users, [POST] https://api.example.com/users",
			);
		});
	});

	describe("Utility methods", () => {
		test("reset() clears all mocks", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/data", { data: "test" });
			fetchMock.reset();

			await expect(fetch("https://api.example.com/data")).rejects.toThrow(
				"No mock found for [GET] https://api.example.com/data",
			);
		});

		test("assertAllMocksUsed() passes when all mocks used", () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/data", { data: "test" });

			// This should throw since we haven't called the mock yet
			expect(() => fetchMock.assertAllMocksUsed()).toThrow();
		});

		test("assertAllMocksUsed() throws when mocks unused", async () => {
			const fetchMock = useFetchMock();

			fetchMock.get("https://api.example.com/data", { data: "test" });

			await fetch("https://api.example.com/data");

			// Now it should pass
			expect(() => fetchMock.assertAllMocksUsed()).not.toThrow();
		});
	});

	describe("Method chaining", () => {
		test("Can chain multiple mock definitions", async () => {
			const fetchMock = useFetchMock();

			fetchMock
				.get("https://api.example.com/users", { data: [] })
				.post("https://api.example.com/users", { data: {}, status: 201 })
				.put("https://api.example.com/users/1", { data: {} })
				.delete("https://api.example.com/users/1", { status: 204 });

			// Test all the chained mocks work
			const getResponse = await fetch("https://api.example.com/users");
			expect(getResponse.status).toBe(200);

			const postResponse = await fetch("https://api.example.com/users", {
				method: "POST",
			});
			expect(postResponse.status).toBe(201);

			const putResponse = await fetch("https://api.example.com/users/1", {
				method: "PUT",
			});
			expect(putResponse.status).toBe(200);

			const deleteResponse = await fetch("https://api.example.com/users/1", {
				method: "DELETE",
			});
			expect(deleteResponse.status).toBe(204);

			fetchMock.assertAllMocksUsed();
		});
	});
});
