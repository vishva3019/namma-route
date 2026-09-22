import axios, { AxiosInstance, AxiosError } from 'axios';
import Logger from '../../utils/logger';

export interface BmtcApiResult<T = any> {
  success: boolean;
  data: T | null;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}

export class BmtcApiClient {
  private client: AxiosInstance;
  public readonly baseUrl: string;
  private timeoutMs: number;
  private lastError: string | null = null;
  private lastAttemptTimestamp: number = 0;
  private isReachableState: boolean = false;

  constructor() {
    this.baseUrl = process.env.BMTC_API_BASE_URL || 'https://bmtcmobileapi.karnataka.gov.in/WebAPI';
    const parsedTimeout = parseInt(process.env.BMTC_API_TIMEOUT || '4000', 10);
    this.timeoutMs = isNaN(parsedTimeout) ? 4000 : parsedTimeout;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'lan': 'en',
        'deviceType': 'WEB',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Origin': 'https://bmtcwebportal.amnex.com',
        'Referer': 'https://bmtcwebportal.amnex.com/',
      },
    });
  }

  /**
   * Helper delay for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Classify error into a structured classification code and message
   */
  private classifyError(err: any): { code: string; message: string; status?: number } {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 403) {
        return {
          code: 'HTTP_403_FORBIDDEN',
          message: 'Upstream BMTC server returned 403 Forbidden (Nginx Geo-blocking or client verification required)',
          status,
        };
      }
      if (status === 401) {
        return {
          code: 'HTTP_401_UNAUTHORIZED',
          message: 'Upstream BMTC server returned 401 Unauthorized',
          status,
        };
      }
      if (status === 404) {
        return {
          code: 'HTTP_404_NOT_FOUND',
          message: 'Endpoint not found on BMTC server',
          status,
        };
      }
      if (status && status >= 500) {
        return {
          code: 'HTTP_SERVER_ERROR',
          message: `Upstream BMTC server returned error HTTP ${status}`,
          status,
        };
      }
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.message.includes('timeout')) {
        return {
          code: 'NETWORK_TIMEOUT',
          message: `BMTC server timed out after ${this.timeoutMs}ms`,
        };
      }
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
        return {
          code: 'NETWORK_UNREACHABLE',
          message: `Unable to connect to BMTC host: ${axiosErr.code}`,
        };
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: err?.message || 'Unknown network or parsing error',
    };
  }

  /**
   * Execute POST request with retry on transient network errors
   */
  async executePost<T = any>(
    endpoint: string,
    payload: any = {},
    maxRetries: number = 2
  ): Promise<BmtcApiResult<T>> {
    const startTime = Date.now();
    this.lastAttemptTimestamp = startTime;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await this.client.post<T>(endpoint, payload);
        const durationMs = Date.now() - startTime;
        this.isReachableState = true;
        this.lastError = null;

        Logger.info(`[BMTC API] POST ${endpoint} succeeded in ${durationMs}ms`);
        return {
          success: true,
          data: response.data,
          status: response.status,
          durationMs,
        };
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const classified = this.classifyError(err);
        this.lastError = classified.message;

        // If it's a 4xx client error (e.g. 403 Forbidden or 401), retrying will not help.
        // Fail immediately without burning retry budget or delaying response.
        const isClientError = classified.status && classified.status >= 400 && classified.status < 500;
        if (isClientError || attempt === maxRetries) {
          this.isReachableState = false;
          Logger.warn(`[BMTC API] POST ${endpoint} failed after ${durationMs}ms: [${classified.code}] ${classified.message}`);
          return {
            success: false,
            data: null,
            status: classified.status,
            errorCode: classified.code,
            errorMessage: classified.message,
            durationMs,
          };
        }

        // Retry with exponential backoff for transient issues
        const backoffMs = Math.min(2000, Math.pow(2, attempt) * 500);
        attempt++;
        Logger.warn(`[BMTC API] POST ${endpoint} attempt ${attempt} failed (${classified.code}). Retrying in ${backoffMs}ms...`);
        await this.delay(backoffMs);
      }
    }

    return {
      success: false,
      data: null,
      errorCode: 'MAX_RETRIES_EXCEEDED',
      errorMessage: this.lastError || 'Max retries exceeded',
      durationMs: Date.now() - startTime,
    };
  }

  async post<T = any>(endpoint: string, data: any = {}): Promise<T | null> {
    const result = await this.executePost<T>(endpoint, data);
    return result.data;
  }

  async searchRoute(routeText: string): Promise<any> {
    return this.post('SearchRoute_v2', { routetext: routeText });
  }

  async getRouteDetails(routeId: number | string): Promise<any> {
    return this.post('SearchByRouteDetails_v4', {
      routeid: typeof routeId === 'string' ? parseInt(routeId, 10) : routeId,
      servicetypeid: 0,
    });
  }

  async getVehicleTripDetails(vehicleId: number | string): Promise<any> {
    return this.post('VehicleTripDetails_v2', {
      vehicleId: typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : vehicleId,
    });
  }

  async listVehicles(regNo: string = ''): Promise<any> {
    return this.post('ListVehicles', {
      vehicleRegNo: regNo,
      deviceType: 'WEB',
    });
  }

  async getAllRoutes(): Promise<any> {
    return this.post('GetAllRouteList', {});
  }

  /**
   * Diagnostic check to test reachability of the BMTC server
   */
  async checkReachability(): Promise<{ reachable: boolean; latencyMs: number; error: string | null; status?: number }> {
    const startTime = Date.now();
    try {
      const res = await this.executePost('SearchRoute_v2', { routetext: '500' }, 0);
      const latencyMs = Date.now() - startTime;
      if (res.success) {
        return { reachable: true, latencyMs, error: null, status: res.status };
      }
      return {
        reachable: false,
        latencyMs,
        error: res.errorMessage || 'BMTC endpoint unreachable',
        status: res.status,
      };
    } catch (err: any) {
      return {
        reachable: false,
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isReachable(): boolean {
    return this.isReachableState;
  }
}

export const bmtcApiClient = new BmtcApiClient();
export default bmtcApiClient;

