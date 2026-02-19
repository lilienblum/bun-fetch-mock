import { afterAll, beforeAll, expect, spyOn } from "bun:test";

const DEFAULT_METHOD = "GET";

type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "DELETE"
	| "PATCH"
	| "HEAD"
	| "OPTIONS";

interface MockResponse<T = unknown> {
	data?: T;
	status?: number;
	headers?: Record<string, string>;
	statusText?: string;
}

/**
 * Options for configuring a mocked response.
 */
export interface MockOpts<T = unknown> extends MockResponse<T> {
	/**
	 * When true, removes this mock after the first matching request.
	 */
	once?: boolean;
}

/**
 * Accepted URL input for registering a mock.
 * Use an absolute URL or a path that starts with `/`.
 */
export type UrlOrPath = `https://${string}` | `http://${string}` | `/${string}`;

function getKey({ method, url }: { method: HttpMethod; url: string }) {
	return `[${method}] ${url}`;
}

function joinBaseUrl(baseUrl: string, path: string) {
	if (!baseUrl) {
		return path;
	}

	const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	return `${normalizedBaseUrl}${path}`;
}

export interface FetchMockOpts {
	/**
	 * Optional base URL prepended to path-style mock URLs (for example `/users`).
	 */
	baseUrl?: string;
}

type ValidationError = {
	message: string;
	url?: string;
	method?: HttpMethod;
};

class FetchMock {
	readonly baseUrl: string;
	readonly mocks = new Map<string, { isUsed: boolean } & MockOpts<unknown>>();
	private mockQueue = new Map<
		string,
		Array<{ isUsed: boolean } & MockOpts<unknown>>
	>();

	constructor(opts: FetchMockOpts) {
		this.baseUrl = opts.baseUrl ?? "";
	}

	private validateUrl(url: UrlOrPath): ValidationError | null {
		if (!url || typeof url !== "string") {
			return { message: "URL must be a non-empty string" };
		}

		if (
			!url.startsWith("http://") &&
			!url.startsWith("https://") &&
			!url.startsWith("/")
		) {
			return { message: "URL must start with http://, https://, or /" };
		}

		return null;
	}

	private validateMethod(method: string): method is HttpMethod {
		const validMethods: HttpMethod[] = [
			"GET",
			"POST",
			"PUT",
			"DELETE",
			"PATCH",
			"HEAD",
			"OPTIONS",
		];
		return validMethods.includes(method as HttpMethod);
	}

	/**
	 * Clears all registered mocks and queued follow-up mocks.
	 */
	reset(this: FetchMock) {
		this.mocks.clear();
		this.mockQueue.clear();

		return this;
	}

	/**
	 * Registers a mock for a `GET` request.
	 */
	get<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("GET", url, opts);
	}

	/**
	 * Registers a mock for a `POST` request.
	 */
	post<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("POST", url, opts);
	}

	/**
	 * Registers a mock for a `PUT` request.
	 */
	put<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("PUT", url, opts);
	}

	/**
	 * Registers a mock for a `DELETE` request.
	 */
	delete<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("DELETE", url, opts);
	}

	/**
	 * Registers a mock for a `PATCH` request.
	 */
	patch<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("PATCH", url, opts);
	}

	/**
	 * Registers a mock for a `HEAD` request.
	 */
	head<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("HEAD", url, opts);
	}

	/**
	 * Registers a mock for an `OPTIONS` request.
	 */
	options<T>(this: FetchMock, url: UrlOrPath, opts?: MockOpts<T>) {
		return this.#mockRequest("OPTIONS", url, opts);
	}

	/**
	 * Asserts that every configured mock has been used at least once.
	 */
	assertAllMocksUsed(this: FetchMock) {
		for (const [key, opts] of this.mocks.entries()) {
			expect(opts.isUsed, `Fetch mock ${key} was not used`).toBe(true);
		}
		for (const [key, queue] of this.mockQueue.entries()) {
			for (const opts of queue) {
				expect(opts.isUsed, `Fetch mock ${key} was not used`).toBe(true);
			}
		}
	}

	/**
	 * Internal fetch implementation used by the `globalThis.fetch` spy.
	 *
	 * @throws If the request method is unsupported or no matching mock exists.
	 */
	async fetchMock(
		this: FetchMock,
		url: string,
		init?: RequestInit,
	): Promise<Response> {
		const methodStr = (init?.method ?? DEFAULT_METHOD).toUpperCase();

		if (!this.validateMethod(methodStr)) {
			throw new Error(
				`Unsupported HTTP method: ${methodStr}. Supported methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS`,
			);
		}

		const method = methodStr as HttpMethod;
		const key = getKey({ method, url });

		const opts = this.mocks.get(key);

		if (!opts) {
			const allMocks = [
				...Array.from(this.mocks.keys()),
				...Array.from(this.mockQueue.keys()),
			];
			const availableMocks = allMocks.join(", ");
			throw new Error(
				`No mock found for ${key}${availableMocks ? `. Available mocks: ${availableMocks}` : ""}`,
			);
		}

		const { once, data, status = 200, headers = {}, statusText = "OK" } = opts;

		opts.isUsed = true;

		if (once) {
			this.mocks.delete(key);
			const queue = this.mockQueue.get(key);
			if (queue && queue.length > 0) {
				const nextMock = queue.shift();
				if (nextMock) {
					this.mocks.set(key, nextMock);
				}
				if (queue.length === 0) {
					this.mockQueue.delete(key);
				}
			}
		}

		if (method === "HEAD") {
			return new Response(null, { status, headers, statusText });
		}

		if (data === undefined) {
			return new Response(null, { status, headers, statusText });
		}

		if (typeof data === "string") {
			return new Response(data, {
				status,
				headers: { "Content-Type": "text/plain", ...headers },
				statusText,
			});
		}

		return Response.json(data, { status, headers, statusText });
	}

	/**
	 * Adds a mock entry for an HTTP method + URL pair.
	 * If one already exists for the same key, queues this mock to be used next.
	 */
	#mockRequest<T>(method: HttpMethod, url: UrlOrPath, opts?: MockOpts<T>) {
		const urlError = this.validateUrl(url);
		if (urlError) {
			throw new Error(`Invalid URL for ${method} mock: ${urlError.message}`);
		}

		const fullUrl = url.startsWith("/") ? joinBaseUrl(this.baseUrl, url) : url;
		const key = getKey({ method, url: fullUrl });

		const mockData = {
			...opts,
			isUsed: false,
		};

		if (this.mocks.has(key)) {
			const queue = this.mockQueue.get(key) || [];
			queue.push(mockData);
			this.mockQueue.set(key, queue);
		} else {
			this.mocks.set(key, mockData);
		}

		return this;
	}
}

/**
 * Creates a fetch mock instance and wires it into Bun's test lifecycle.
 *
 * `fetch` is mocked immediately and restored in `afterAll`.
 * Call this at module scope or inside `describe(...)`, not inside `test(...)`.
 */
export function useFetchMock(opts: FetchMockOpts = {}) {
	const mock = new FetchMock(opts);
	const spyFetch = spyOn(globalThis, "fetch");

	spyFetch.mockImplementation(
		(mock.fetchMock as unknown as typeof fetch).bind(mock),
	);

	try {
		beforeAll(() => {
			if (!spyFetch.mock) {
				spyFetch.mockImplementation(
					(mock.fetchMock as unknown as typeof fetch).bind(mock),
				);
			}
		});

		afterAll(() => {
			spyFetch.mockRestore();
		});
	} catch (error) {
		spyFetch.mockRestore();
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			`useFetchMock() must be called at module scope or inside describe(), not inside test(). ${detail}`,
		);
	}

	return mock;
}
