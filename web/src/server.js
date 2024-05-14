"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = __importDefault(require("./logger"));
var app_1 = __importDefault(require("./app"));
try {
    // Listen the API on port 3000 (default)
    app_1.default.listen(process.env.APP_PORT, function () {
        logger_1.default.info("Node environment: ".concat(process.env.NODE_ENV));
        logger_1.default.info("Listening on port ".concat(process.env.APP_PORT));
    });
}
catch (error) {
    logger_1.default.error(error);
}
//# sourceMappingURL=server.js.map