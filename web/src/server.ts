import logger from './logger';
import app from './app';

try {
    // Listen the API on port 3000 (default)
    app.listen(process.env.APP_PORT, () => {
        logger.info(`Node environment: ${process.env.NODE_ENV}`);
        logger.info(`Listening on port ${process.env.APP_PORT}`);
    });
} catch (error) {
    logger.error(error);
}
