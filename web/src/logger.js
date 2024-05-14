"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIp = void 0;
var winston_1 = require("winston");
var moment_1 = __importDefault(require("moment"));
var getIp = function (request) {
    return request.headers['x-forwarded-for'] || request.connection.remoteAddress || request.socket.remoteAddress;
};
exports.getIp = getIp;
// Create console Transport
var combine = winston_1.format.combine, colorize = winston_1.format.colorize, printf = winston_1.format.printf;
var formats = [];
formats.push(colorize({ level: true }));
formats.push(printf(function (_a) {
    var level = _a.level, message = _a.message;
    return "".concat((0, moment_1.default)().format('HH:mm:ss'), " ").concat(level, ": ").concat(message);
}));
var consoleTransport = new winston_1.transports.Console({
    format: combine.apply(void 0, formats),
    level: 'silly',
    silent: false, // Doesn't log if we are in testing environment and if the logging is disabled
});
var loggingTransports = [consoleTransport];
// Create the production/development logger
var logger = (0, winston_1.createLogger)({
    transports: loggingTransports,
});
// @ts-ignore
logger.error = function (error) {
    if (error instanceof Error) {
        logger.log({ level: 'error', message: "".concat(error.stack || error) });
    }
    else {
        logger.log({ level: 'error', message: error });
    }
};
exports.default = logger;
//# sourceMappingURL=logger.js.map