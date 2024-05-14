"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importStar(require("express"));
var dotenv_1 = __importDefault(require("dotenv"));
var client_1 = require("@prisma/client");
var path_1 = __importDefault(require("path"));
var cookie_parser_1 = __importDefault(require("cookie-parser"));
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var fast_xml_parser_1 = require("fast-xml-parser");
var body_parser_1 = __importDefault(require("body-parser"));
var logger_1 = __importDefault(require("./logger"));
var Sentry = __importStar(require("@sentry/node"));
var prisma = new client_1.PrismaClient();
dotenv_1.default.config();
var app = (0, express_1.default)();
var webRouter = (0, express_1.Router)();
function authenticate(request) {
    if (!request.cookies["token"]) {
        return null;
    }
    try {
        return jsonwebtoken_1.default.verify(request.cookies["token"], process.env.JWT_SECRET).login;
    }
    catch (e) {
        return null;
    }
}
var validOpening = {
    codeGeneratedAt: { gte: new Date(Date.now() - 1000 * 60 * 5) },
};
var currentlyBorrowing = {
    borrowOpening: { date: { not: null } },
    returnOpening: { date: null },
};
function generateCode() {
    return __awaiter(this, void 0, void 0, function () {
        var code, found, ciffers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ciffers = "0123456789";
                    _a.label = 1;
                case 1:
                    code =
                        ciffers[Math.floor(Math.random() * 10)] +
                            ciffers[Math.floor(Math.random() * 10)] +
                            ciffers[Math.floor(Math.random() * 10)] +
                            ciffers[Math.floor(Math.random() * 10)];
                    return [4 /*yield*/, prisma.opening.findFirst({ where: { code: code } })];
                case 2:
                    found = _a.sent();
                    _a.label = 3;
                case 3:
                    if (found) return [3 /*break*/, 1];
                    _a.label = 4;
                case 4: return [2 /*return*/, code];
            }
        });
    });
}
function getJoyconsLeft() {
    return __awaiter(this, void 0, void 0, function () {
        var joyconBorrows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.borrow.findMany({ where: { borrowOpening: { OR: [validOpening, { date: { not: null } }] }, returnOpening: { date: { not: null } } } })];
                case 1:
                    joyconBorrows = _a.sent();
                    return [2 /*return*/, Number.parseInt(process.env.TOTAL_JOYCONS) - joyconBorrows.reduce(function (acc, borrow) { return acc + borrow.joyconsTaken; }, 0)];
            }
        });
    });
}
webRouter.get("/", function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var login, borrow, code;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                login = authenticate(request);
                if (!login) {
                    return [2 /*return*/, response.redirect("/login")];
                }
                if (request.query['code']) {
                    return [2 /*return*/, response.sendFile(path_1.default.join(__dirname, '../www/getCode.html'))];
                }
                return [4 /*yield*/, prisma.borrow.findFirst({
                        where: __assign({ user: { login: login } }, currentlyBorrowing),
                    })];
            case 1:
                borrow = _a.sent();
                if (!borrow) {
                    return [2 /*return*/, response.sendFile(path_1.default.join(__dirname, "../www/borrow.html"))];
                }
                return [4 /*yield*/, generateCode()];
            case 2:
                code = _a.sent();
                return [4 /*yield*/, prisma.borrow.update({ where: { id: borrow.id }, data: { returnOpening: { upsert: { create: { code: code, codeGeneratedAt: new Date(Date.now()) }, update: { code: code, codeGeneratedAt: new Date(Date.now()) } } } } })];
            case 3:
                _a.sent();
                return [2 /*return*/, response.redirect("/?code=".concat(code))];
        }
    });
}); });
webRouter.get("/login", function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var res, resData, _a, _b, userData, user, token;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (authenticate(request)) {
                    return [2 /*return*/, response.redirect("/")];
                }
                if (!request.query["ticket"]) return [3 /*break*/, 6];
                return [4 /*yield*/, fetch("https://cas.utt.fr/cas/serviceValidate?service=".concat(encodeURI(process.env.CAS_SERVICE), "&ticket=").concat(request.query["ticket"]))];
            case 1:
                res = _c.sent();
                _b = (_a = new fast_xml_parser_1.XMLParser()).parse;
                return [4 /*yield*/, res.text()];
            case 2:
                resData = _b.apply(_a, [_c.sent()]);
                if ("cas:authenticationFailure" in resData["cas:serviceResponse"]) {
                    return [2 /*return*/, { status: "invalid", token: "" }];
                }
                userData = {
                    login: resData["cas:serviceResponse"]["cas:authenticationSuccess"]["cas:attributes"]["cas:uid"],
                    mail: resData["cas:serviceResponse"]["cas:authenticationSuccess"]["cas:attributes"]["cas:mail"],
                    lastName: resData["cas:serviceResponse"]["cas:authenticationSuccess"]["cas:attributes"]["cas:sn"],
                    firstName: resData["cas:serviceResponse"]["cas:authenticationSuccess"]["cas:attributes"]["cas:givenName"],
                    // TODO : fetch other infos from LDAP
                };
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { login: userData.login },
                    })];
            case 3:
                user = _c.sent();
                if (!!user) return [3 /*break*/, 5];
                return [4 /*yield*/, prisma.user.create({ data: userData })];
            case 4:
                _c.sent();
                _c.label = 5;
            case 5:
                token = jsonwebtoken_1.default.sign({ login: userData.login }, process.env.JWT_SECRET, {
                    expiresIn: process.env.JWT_EXPIRES_IN,
                });
                return [2 /*return*/, response.cookie("token", token).redirect("/")];
            case 6: return [2 /*return*/, response.sendFile(path_1.default.join(__dirname, "../www/login.html"))];
        }
    });
}); });
webRouter.get("/login/cas", function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, response.redirect("https://cas.utt.fr/cas/login?service=".concat(encodeURI(process.env.CAS_SERVICE)))];
    });
}); });
webRouter.post("/", function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var login, joycons, joyconsLeft, code;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                login = authenticate(request);
                if (!login) {
                    return [2 /*return*/, response.redirect("/login")];
                }
                joycons = Number.parseInt(request.body.joycons);
                return [4 /*yield*/, getJoyconsLeft()];
            case 1:
                joyconsLeft = _a.sent();
                if (joycons < 0 || joycons > joyconsLeft) {
                    return [2 /*return*/, response.send("Il ne reste plus que ".concat(joyconsLeft, " joycons disponibles"))];
                }
                return [4 /*yield*/, generateCode()];
            case 2:
                code = _a.sent();
                return [4 /*yield*/, prisma.borrow.create({
                        data: {
                            joyconsTaken: joycons,
                            borrowOpening: {
                                create: {
                                    code: code,
                                    codeGeneratedAt: new Date(),
                                },
                            },
                            returnOpening: { create: {} },
                            user: { connect: { login: login } },
                        },
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/, response.redirect("/?code=".concat(code))];
        }
    });
}); });
var apiRouter = (0, express_1.Router)();
apiRouter.post("/sesame", function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var sesame, opening, returnCode;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                sesame = request.body.code;
                if (!sesame)
                    return [2 /*return*/, response.status(400).send("Missing code")];
                if (typeof sesame !== "string" ||
                    sesame.length !== (Number(process.env.SESAME_LENGTH) || 4))
                    return [2 /*return*/, response.status(400).send("Invalid code")];
                return [4 /*yield*/, prisma.opening.findMany({
                        where: {
                            code: sesame,
                            date: null,
                            codeGeneratedAt: new Date(Date.now() - 1000 * 60 * 5),
                        },
                        select: {
                            return: {
                                select: {
                                    returnOpeningId: true,
                                },
                            },
                        },
                    })];
            case 1:
                opening = (_a.sent())[0];
                if (!opening) {
                    logger_1.default.info("Invalid Sesame provided : ".concat(sesame));
                    return [2 /*return*/, response.status(403).send("Invalid sesame")];
                }
                if (!opening.return) return [3 /*break*/, 4];
                return [4 /*yield*/, generateCode()];
            case 2:
                returnCode = _a.sent();
                return [4 /*yield*/, prisma.opening.update({
                        where: {
                            id: opening.return.returnOpeningId,
                        },
                        data: {
                            code: returnCode,
                            codeGeneratedAt: new Date(),
                        },
                    })];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [2 /*return*/, response.status(200).send("Sésame ouvre toi")];
        }
    });
}); });
if (process.env.SENTRY_DSN) {
    // Initiate Sentry
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: 1.0,
    });
    Sentry.setupExpressErrorHandler(app);
}
// Enable morgan logger
// app.use(morgan());
// Enable compression
// app.use(compression());
// Security middlewares
// app.use(cors(), helmet());
app.use("", (0, cookie_parser_1.default)());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use("", webRouter);
// Main routes
app.use(process.env.API_PREFIX, apiRouter);
// Not found
// app.use((request: Request, response: Response) => notFound(response, Error.RouteNotFound));
// Error Handles
// app.use(errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map