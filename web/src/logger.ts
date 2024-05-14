/* eslint-disable no-console */
import { Request } from 'express';
import { Format } from 'logform';
import { ConsoleTransportInstance } from 'winston/lib/winston/transports';
import split from 'split';
import morganMiddleware from 'morgan';
import { createLogger, format, transports } from 'winston';
import moment from 'moment';
import * as http from "http";

export const getIp = (request: Request | http.IncomingMessage): string =>
  (request.headers['x-forwarded-for'] as string) || request.connection.remoteAddress || request.socket.remoteAddress;

export type WinstonLog = { message: string; level: string };

// Create console Transport
const { combine, colorize, printf } = format;

const formats: Format[] = [];

formats.push(colorize({ level: true }));

formats.push(printf(({ level, message }) => `${moment().format('HH:mm:ss')} ${level}: ${message}`));

const consoleTransport = new transports.Console({
  format: combine(...formats),
  level: 'silly',
  silent: false, // Doesn't log if we are in testing environment and if the logging is disabled
});

const loggingTransports: Array<ConsoleTransportInstance> = [consoleTransport];

// Create the production/development logger
const logger = createLogger({
  transports: loggingTransports,
});

// @ts-ignore
logger.error = (error) => {
  if (error instanceof Error) {
    logger.log({ level: 'error', message: `${error.stack || error}` });
  } else {
    logger.log({ level: 'error', message: error });
  }
};

export default logger;
