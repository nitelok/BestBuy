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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = exports.createBrowser = void 0;
const playwright_1 = require("playwright");
let browser;
exports.createBrowser = () => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        headless: false,
        ignoreHTTPSErrors: true,
        defaultViewport: { width: 1920, height: 1080 }
    };
    browser = yield playwright_1.firefox.launch(options);
    return browser;
});
exports.getBrowser = () => {
    return browser;
};
