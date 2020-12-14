"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("@driver/index");
const bestbuy_1 = require("@pages/bestbuy");
const configs_1 = require("@core/configs");
const lodash_1 = require("lodash");
const logger_1 = require("@core/logger");
const discord_1 = require("@core/notifications/discord");
const fs_1 = require("fs");
const pm2_1 = __importDefault(require("pm2"));
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const { stores } = configs_1.getTasks()[0];
    const { bestbuy: bestbuyConfig } = stores;
    if (fs_1.existsSync('purchase.json')) {
        logger_1.logger.warn('Purchase completed, sleeping for 2 days');
        yield bestbuy_1.wait(60000 * 60 * 48);
        process.exit(2);
    }
    const bestbuy = new bestbuy_1.BestBuy({ products: bestbuyConfig.products });
    let purchaseCompleted = false;
    yield bestbuy.open();
    logger_1.logger.info('Starting purchase attempts');
    try {
        do {
            purchaseCompleted = yield bestbuy.purchaseProduct();
            if (!purchaseCompleted) {
                const waitTime = lodash_1.random(10000, 30000);
                logger_1.logger.warn(`Purchase not completed, waiting ${waitTime} ms before retrying`);
                yield bestbuy_1.wait(waitTime);
            }
        } while (!purchaseCompleted);
        logger_1.logger.info('Shutting down in 1 minute');
        yield Promise.all([
            yield discord_1.sendMessage({ message: 'Shutting down in 1 minute' }),
        ]);
        yield bestbuy_1.wait(60000);
        yield bestbuy.close();
        return true;
    }
    catch (error) {
        console.log(error);
        yield bestbuy.close();
        throw error;
    }
});
pm2_1.default.connect((error) => __awaiter(void 0, void 0, void 0, function* () {
    if (error) {
        logger_1.logger.error(error);
        process.exit(2);
    }
    yield index_1.createBrowser();
    const browser = index_1.getBrowser();
    let finished = false;
    do {
        try {
            finished = yield main();
        }
        catch (error) {
            logger_1.logger.error(error);
            if (error.message === 'Browser is considered a bot, aborting attempt') {
                logger_1.logger.warn('Waiting 3 minutes to refresh bot status');
                yield bestbuy_1.wait(180000);
            }
        }
    } while (!finished);
    yield browser.close();
    pm2_1.default.delete('main', () => {
        logger_1.logger.info('Process closed');
    });
}));
