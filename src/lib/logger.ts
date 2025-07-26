export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  method: string
  url: string
  statusCode?: number
  duration?: number
  message: string
  error?: string
  userId?: string
  folderId?: string
  fileId?: string
}

export class Logger {
  private static formatMessage(entry: LogEntry): string {
    const { timestamp, level, method, url, statusCode, duration, message, error, userId, folderId, fileId } = entry
    
    let logMsg = `[${timestamp}] ${level.toUpperCase()} ${method} ${url}`
    
    if (statusCode) logMsg += ` ${statusCode}`
    if (duration) logMsg += ` ${duration}ms`
    if (userId) logMsg += ` user:${userId}`
    if (folderId) logMsg += ` folder:${folderId}`
    if (fileId) logMsg += ` file:${fileId}`
    
    logMsg += ` - ${message}`
    
    if (error) logMsg += ` ERROR: ${error}`
    
    return logMsg
  }

  static info(data: Omit<LogEntry, 'level' | 'timestamp'>): void {
    const entry: LogEntry = {
      ...data,
      level: 'info',
      timestamp: new Date().toISOString()
    }
    console.log(this.formatMessage(entry))
  }

  static warn(data: Omit<LogEntry, 'level' | 'timestamp'>): void {
    const entry: LogEntry = {
      ...data,
      level: 'warn',
      timestamp: new Date().toISOString()
    }
    console.warn(this.formatMessage(entry))
  }

  static error(data: Omit<LogEntry, 'level' | 'timestamp'>): void {
    const entry: LogEntry = {
      ...data,
      level: 'error',
      timestamp: new Date().toISOString()
    }
    console.error(this.formatMessage(entry))
  }

  static debug(data: Omit<LogEntry, 'level' | 'timestamp'>): void {
    const entry: LogEntry = {
      ...data,
      level: 'debug',
      timestamp: new Date().toISOString()
    }
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(entry))
    }
  }

  static request(method: string, url: string, message: string = 'Request received'): void {
    this.info({ method, url, message })
  }

  static response(method: string, url: string, statusCode: number, duration: number, message: string = 'Request completed'): void {
    this.info({ method, url, statusCode, duration, message })
  }
}