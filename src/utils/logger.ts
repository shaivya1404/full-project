import winston from 'winston';
import { config } from '../config/env';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = config.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info as any;
    let msgText: string;
    try {
      msgText = typeof message === 'string' ? message : JSON.stringify(message);
    } catch (e) {
      msgText = String(message);
    }
    const meta = Object.keys(rest).length ? ' ' + JSON.stringify(rest, null, 2) : '';
    return `${timestamp} ${level}: ${msgText}${meta}`;
  }),
);

const transports = [new winston.transports.Console()];

export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});
