import express, { Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from "@prisma/client";
import path from "path";
import cookieParser from 'cookie-parser';
import jwt, {TokenExpiredError} from 'jsonwebtoken';
import {XMLParser} from "fast-xml-parser";

// import * as Sentry from '@sentry/node';
// import cors from 'cors';
// import helmet from 'helmet';

// import { notFound } from './utils/responses';
// import { Error } from './types';
// import router from './controllers';
// import { morgan } from './utils/logger';
// import { initUserRequest } from './middlewares/user';
// import errorHandler from './middlewares/errorHandler';
// import { enforceQueryString } from './middlewares/validation';
// import rateLimiter from './middlewares/ratelimiter';

const prisma = new PrismaClient();
dotenv.config();
const app = express();

const webRouter = Router();

function authenticate(request: Request) {
  if (!request.cookies['token']) {
    return null;
  }
  try {
    return jwt.verify(request.cookies['token'], process.env.JWT_SECRET);
  } catch (e) {
    return null
  }
}

webRouter.get('/', (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) {
    return response.redirect('/login');
  }
  response.sendFile(path.join(__dirname, '../www/index.html'));
});

webRouter.get('/login', async (request: Request, response: Response) => {
  if (authenticate(request)) {
    return response.redirect('/');
  }
  if (request.query['ticket']) {
    const res = await fetch(`https://cas.utt.fr/cas/serviceValidate?service=${encodeURI(process.env.CAS_SERVICE)}&ticket=${request.query['ticket']}`)
    const resData: {
      ['cas:serviceResponse']:
        | {
        ['cas:authenticationSuccess']: {
          ['cas:attributes']: {
            'cas:uid': string;
            'cas:mail': string;
            'cas:sn': string;
            'cas:givenName': string;
          };
        };
      }
        | { 'cas:authenticationFailure': unknown };
    } = new XMLParser().parse(await res.text());
    if ('cas:authenticationFailure' in resData['cas:serviceResponse']) {
      return { status: 'invalid', token: '' };
    }
    const userData = {
      login: resData['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:uid'],
      mail: resData['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:mail'],
      lastName: resData['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:sn'],
      firstName: resData['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:givenName'],
      // TODO : fetch other infos from LDAP
    };
    let user = await prisma.user.findUnique({where: {login: userData.login}});
    if (!user) {
      await prisma.user.create({data: userData});
    }
    const token = jwt.sign(userData.login, process.env.JWT_TOKEN, {expiresIn: process.env.JWT_EXPIRES_IN});
    return response.cookie('token', token).redirect('/');
  }
  return response.sendFile(path.join(__dirname, '../www/login.html'));
});

webRouter.get('/login/cas', async (request: Request, response: Response) => {
  return response.redirect(`https://cas.utt.fr/cas/login?service=${encodeURI(process.env.CAS_SERVICE)}`)
})

webRouter.post('/', (request: Request, response: Response) => {
  response.send('Hello World');
});

const apiRouter = Router();

apiRouter.post('/sesame', (request: Request, response: Response) => {
  response.send('Open Sesame');

});

// Initiate Sentry
// Sentry.init({ dsn: env.log.sentryDsn, environment: env.environment });
// app.use(Sentry.Handlers.requestHandler({}));

// Enable morgan logger
// app.use(morgan());

// Enable compression
// app.use(compression());

// Security middlewares
// app.use(cors(), helmet());

app.use('', cookieParser());

app.use('', webRouter);

// Main routes
app.use(process.env.API_PREFIX, apiRouter);

// Not found
// app.use((request: Request, response: Response) => notFound(response, Error.RouteNotFound));

// Error Handles
// app.use(errorHandler);

export default app;
