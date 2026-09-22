export class Logger {
  private static sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = { ...obj };
    const sensitiveKeys = [
      'authorization',
      'token',
      'apikey',
      'api_key',
      'cookie',
      'password',
      'secret',
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  static info(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO] ${message}`, this.sanitize(meta));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  }

  static warn(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${message}`, this.sanitize(meta));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  }

  static error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    if (error instanceof Error) {
      console.error(`[${timestamp}] [ERROR] ${message}: ${error.message}`);
    } else if (error) {
      console.error(`[${timestamp}] [ERROR] ${message}`, this.sanitize(error));
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`);
    }
  }

  static providerRequest(endpoint: string, durationMs: number, vehicleCount: number, cacheHit: boolean) {
    this.info(`[Provider Request] ${endpoint} - ${durationMs}ms - Vehicles: ${vehicleCount} - Cache: ${cacheHit ? 'HIT' : 'MISS'}`);
  }
}

export default Logger;
