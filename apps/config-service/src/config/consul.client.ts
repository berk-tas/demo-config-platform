import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class ConsulClient {
  private readonly logger = new Logger(ConsulClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = process.env.CONSUL_HTTP_ADDR ?? "http://localhost:8500";
    this.http = axios.create({ baseURL, timeout: 5000 });
  }

  async putKey(key: string, value: unknown): Promise<void> {
    const body =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const res = await this.http.put(`/v1/kv/${key}`, body, {
      headers: { "Content-Type": "application/json" },
      transformResponse: (r) => r,
    });
    const ok =
      res.data === true || res.data === "true" || res.data === "true\n";
    if (!ok) {
      throw new Error(`consul putKey ${key} returned ${JSON.stringify(res.data)}`);
    }
    this.logger.log(`PUT ${key} (${body.length} bytes)`);
  }

  async getKey<T = unknown>(key: string): Promise<T | null> {
    try {
      const res = await this.http.get(`/v1/kv/${key}`, {
        params: { raw: true },
      });
      return res.data as T;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async listKeys(prefix: string): Promise<string[]> {
    try {
      const res = await this.http.get<string[]>(`/v1/kv/${prefix}`, {
        params: { keys: true },
      });
      return res.data ?? [];
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return [];
      }
      throw err;
    }
  }
}
