import type { DataSource, DataSourceStatus } from "../../types/dataSource";
import type { DataSourceAdapter, AdapterFetchResult, AdapterConnectOptions, FetchRequestConfig } from "./types";
import { extractData } from "./types";

interface ActiveConnection {
  controller: AbortController | null;
  status: DataSourceStatus;
}

export class HttpAdapter implements DataSourceAdapter {
  readonly type = "http";

  private connections: Record<string, ActiveConnection> = {};

  async connect(ds: DataSource, options: AdapterConnectOptions): Promise<void> {
    this.disconnect(ds.id);

    if (!ds.connection.url) {
      options.onStatusChange("error", "HTTP 未配置 URL");
      return;
    }

    this.connections[ds.id] = { controller: null, status: "connecting" };
    options.onStatusChange("connecting");

    try {
      const baseUrl = ds.connection.url.replace(/\/+$/, "");
      const testApi = ds.testApis.length > 0 ? ds.testApis[0] : null;
      const testPath = testApi?.path
        ? (testApi.path.startsWith("/") ? testApi.path : `/${testApi.path}`)
        : "";
      const fullUrl = testPath ? `${baseUrl}${testPath}` : baseUrl;

      const method = testApi?.method || "GET";
      const body = testApi?.body;

      const headers: Record<string, string> = {};
      ds.connection.headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => { headers[h.key] = h.value; });
      if (body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ds.connection.timeout);

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: method !== "GET" ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.connections[ds.id] = { controller: null, status: "connected" };
        options.onStatusChange("connected");
      } else {
        const errorText = await response.text().catch(() => "");
        this.connections[ds.id] = { controller: null, status: "failed" };
        options.onStatusChange("failed", `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      this.connections[ds.id] = { controller: null, status: "error" };
      options.onStatusChange("error", error instanceof Error ? error.message : "连接测试失败");
    }
  }

  disconnect(dsId: string): void {
    const conn = this.connections[dsId];
    if (conn?.controller) {
      conn.controller.abort();
    }
    delete this.connections[dsId];
  }

  async fetch(config: FetchRequestConfig): Promise<AdapterFetchResult> {
    if (!config.url) {
      throw new Error("HTTP 请求未配置 URL");
    }

    const headers: Record<string, string> = { ...config.headers };

    const queryParams: Record<string, string> = {};
    const bodyParams: Record<string, string> = {};
    config.params
      .filter((p) => p.key)
      .forEach((p) => {
        if (p.location === "query") {
          queryParams[p.key] = p.value;
        } else if (p.location === "body") {
          bodyParams[p.key] = p.value;
        } else if (p.location === "header") {
          headers[p.key] = p.value;
        }
      });

    let requestUrl = config.url;
    if (Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams(queryParams);
      requestUrl = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}${searchParams.toString()}`;
    }

    let requestBody: string | undefined;
    if (config.method !== "GET") {
      if (config.body) {
        requestBody = config.body;
      } else if (Object.keys(bodyParams).length > 0) {
        requestBody = JSON.stringify(bodyParams);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(requestUrl, {
        method: config.method,
        headers,
        body: config.method !== "GET" ? requestBody : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败 (${response.status}): ${errorText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let responseData: unknown;
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      const extracted = extractData(responseData, config.responseMapping);

      return {
        raw: responseData,
        extracted,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  isConnected(dsId: string): boolean {
    return this.connections[dsId]?.status === "connected";
  }

  getStatus(dsId: string): DataSourceStatus | undefined {
    return this.connections[dsId]?.status;
  }

  destroy(): void {
    Object.keys(this.connections).forEach((id) => this.disconnect(id));
  }
}
