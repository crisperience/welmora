// Type definitions
type LogData = Record<string, string | number | boolean>;
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Simple, clean logger for Welmora
 * Structured logging for development and production
 */
export class WelmoraLogger {
  private context: string;
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  constructor(context: string = 'App') {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString();
    const contextStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private logStructured(level: LogLevel, message: string, data?: LogData, error?: Error) {
    const logData = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      ...data,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    if (this.isDevelopment) {
      const formatted = this.formatMessage(level, message, data);
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
        case 'fatal':
          console.error(formatted);
          if (error) console.error(error);
          break;
      }
    }

    if (this.isProduction) {
      switch (level) {
        case 'info':
        case 'warn':
          console.log(JSON.stringify(logData));
          break;
        case 'error':
        case 'fatal':
          console.error(JSON.stringify(logData));
          break;
      }
    }
  }

  /**
   * Log debug level messages for development
   */
  debug(message: string, data?: LogData) {
    if (this.isDevelopment) {
      this.logStructured('debug', message, data);
    }
  }

  /**
   * Log info level messages for general application flow
   */
  info(message: string, data?: LogData) {
    this.logStructured('info', message, data);
  }

  /**
   * Log warning level messages for potential issues
   */
  warn(message: string, data?: LogData) {
    this.logStructured('warn', message, data);
  }

  /**
   * Log error level messages
   */
  error(message: string, error?: Error | unknown, data?: LogData) {
    const err = error instanceof Error ? error : undefined;
    this.logStructured('error', message, data, err);
  }

  /**
   * Log fatal level messages for critical system failures
   */
  fatal(message: string, error?: Error | unknown, data?: LogData) {
    const err = error instanceof Error ? error : undefined;
    this.logStructured('fatal', message, data, err);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: string): WelmoraLogger {
    return new WelmoraLogger(`${this.context}:${additionalContext}`);
  }

  /**
   * Log API errors with context
   */
  apiError(endpoint: string, error: Error, data?: LogData) {
    this.error(`API Error in ${endpoint}`, error, {
      endpoint,
      ...data,
    });
  }

  /**
   * Log database errors with context
   */
  dbError(operation: string, error: Error, data?: LogData) {
    this.error(`Database Error: ${operation}`, error, {
      operation,
      ...data,
    });
  }

  /**
   * Log external service errors with context
   */
  serviceError(service: string, error: Error, data?: LogData) {
    this.error(`External Service Error: ${service}`, error, {
      service,
      ...data,
    });
  }
}

/**
 * Create logger instances for different parts of the application
 */
export const createLogger = (context: string): WelmoraLogger => new WelmoraLogger(context);

/**
 * Default logger instance
 */
export const logger = new WelmoraLogger('Welmora');

/**
 * Specialized loggers for different domains
 */
export const apiLogger = createLogger('API');
export const dbLogger = createLogger('Database');
export const serviceLogger = createLogger('Service');
export const scraperLogger = createLogger('Scraper');
export const wooCommerceLogger = createLogger('WooCommerce');
export const supabaseLogger = createLogger('Supabase');

export default logger;
