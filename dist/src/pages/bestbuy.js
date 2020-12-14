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
exports.BestBuy = exports.wait = void 0;
const index_1 = require("@driver/index");
const lodash_1 = require("lodash");
const configs_1 = require("@core/configs");
const logger_1 = require("@core/logger");
const path_1 = require("path");
const discord_1 = require("@core/notifications/discord");
const fs_1 = require("fs");
exports.wait = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
const bestBuyUrl = 'https://bestbuy.com';
class BestBuy {
    constructor({ products }) {
        this.browser = index_1.getBrowser();
        this.products = products;
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            this.context = yield this.browser.newContext({
                permissions: [],
            });
            this.page = yield this.context.newPage();
            return this.page;
        });
    }
    close() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            yield ((_a = this.page) === null || _a === void 0 ? void 0 : _a.close());
            yield ((_b = this.context) === null || _b === void 0 ? void 0 : _b.close());
            this.page = undefined;
            this.context = undefined;
        });
    }
    purchaseProduct() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            yield page.goto('https://bestbuy.com');
            for (const product of this.products) {
                try {
                    yield this.goToProductPage(product);
                    yield this.validateProductMatch(product);
                    yield this.addToCart(product);
                    yield this.checkout();
                    yield this.continueAsGuest();
                    yield this.submitGuestOrder();
                    return true;
                }
                catch (error) {
                    logger_1.logger.error(error);
                    if (error.message === 'Browser is considered a bot, aborting attempt')
                        throw error;
                }
            }
            return false;
        });
    }
    goToProductPage(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const { productPage } = product;
            const page = yield this.getPage();
            logger_1.logger.info(`Navigating to ${bestBuyUrl}${productPage}`);
            yield page.goto(`${bestBuyUrl}${productPage}`, { timeout: 60000 });
            yield page.waitForSelector('.sku.product-data');
            logger_1.logger.info(`Navigation completed`);
        });
    }
    validateProductMatch(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sku: expectedSKU } = product;
            const page = yield this.getPage();
            logger_1.logger.info(`Validating that page corresponds to sku ${expectedSKU}`);
            const skuValue = yield page.$eval('.sku.product-data .product-data-value', (element) => element.textContent);
            if (expectedSKU !== skuValue.trim())
                throw new Error(`Product page does not belong to product with sku ${expectedSKU}`);
            logger_1.logger.info(`Page corresponds to sku ${expectedSKU}`);
        });
    }
    addToCart(product) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { productName } = product;
            const page = yield this.getPage();
            const [context] = this.browser.contexts();
            const cookies = yield context.cookies();
            const sensorCookie = (_a = lodash_1.find(cookies, { name: '_abck' })) === null || _a === void 0 ? void 0 : _a.value;
            const sensorValidationRegex = /~0~/g;
            if (sensorCookie && !sensorValidationRegex.test(sensorCookie)) {
                yield Promise.all([
                    discord_1.sendMessage({ message: `Browser is considered a bot, aborting attempt` }),
                ]);
                throw new Error('Browser is considered a bot, aborting attempt');
            }
            logger_1.logger.info(`Checking stock of product "${productName}"`);
            if (!(yield this.isInStock()))
                throw new Error('Product not in stock, aborting attempt');
            yield page.focus('.add-to-cart-button:not([disabled])');
            const productInStockScreenshotPath = path_1.resolve(`screenshots/${Date.now()}_product-in-stock.png`);
            yield page.screenshot({
                path: productInStockScreenshotPath,
                type: 'png'
            });
            yield Promise.all([
                discord_1.sendMessage({ message: `Product "${productName}" in stock!`, image: productInStockScreenshotPath }),
            ]);
            logger_1.logger.info(`"${productName}" in stock, adding to cart...`);
            yield page.click('.add-to-cart-button:not([disabled])');
            const result = yield this.hasItemBeenAddedToCart();
            if (!result)
                throw new Error(`Product "${productName}" was not able to be added to the cart`);
            const productAddedImagePath = path_1.resolve(`screenshots/${Date.now()}_product-added.png`);
            logger_1.logger.info(`Product "${productName}" added to cart!`);
            yield page.screenshot({
                path: productAddedImagePath,
                type: 'png'
            });
            yield Promise.all([
                discord_1.sendMessage({ message: `Product "${productName}" added to cart!`, image: productAddedImagePath }),
            ]);
        });
    }
    isInStock() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            const enabledButton = yield page.$('.add-to-cart-button:not([disabled])');
            if (enabledButton)
                return true;
            return false;
        });
    }
    hasItemBeenAddedToCart() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            const completedSuccessfuly = yield page.waitForResponse((response) => response.url() === 'https://www.bestbuy.com/cart/api/v1/addToCart' && response.status() === 200);
            return completedSuccessfuly;
        });
    }
    checkout(retrying = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            const customerInformation = configs_1.getCustomerInformation();
            logger_1.logger.info(`Navigating to cart`);
            yield page.goto('https://www.bestbuy.com/cart');
            if (retrying && (yield this.isCartEmpty()))
                throw new Error('Cart is empty, aborting attempt');
            if (!retrying) {
                let attempt = 1;
                let shippingSelected = false;
                yield this.changeZipCode(customerInformation.zipcode);
                do {
                    try {
                        yield page.waitForSelector('[name=availability-selection][id*=shipping]', { timeout: 3500 });
                        yield page.click('[name=availability-selection][id*=shipping]');
                        yield exports.wait(500);
                        shippingSelected = true;
                    }
                    catch (error) {
                        attempt += 1;
                        if (attempt > 3)
                            throw new Error("Can't select shipping, aborting attempt");
                    }
                } while (!shippingSelected);
            }
            const startingCheckoutScreenshotPath = path_1.resolve(`screenshots/${Date.now()}_starting-checkout.png`);
            yield page.screenshot({
                path: startingCheckoutScreenshotPath,
                type: 'png'
            });
            yield Promise.all([
                discord_1.sendMessage({ message: `Attempting checkout`, image: startingCheckoutScreenshotPath }),
            ]);
            yield this.clickCheckoutButton();
            try {
                yield page.waitForSelector('.cia-guest-content .js-cia-guest-button', { timeout: 10000 });
                logger_1.logger.info('Checkout successful, starting order placement');
            }
            catch (error) {
                logger_1.logger.warn(error);
                logger_1.logger.info('Refreshing and trying to checkout again');
                yield Promise.all([
                    discord_1.sendMessage({ message: `Checkout did not went through, trying again`, image: startingCheckoutScreenshotPath }),
                ]);
                yield this.checkout(true);
            }
        });
    }
    isCartEmpty() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            const element = yield page.$('.fluid-large-view__title');
            const elementTextContent = yield (element === null || element === void 0 ? void 0 : element.textContent());
            return elementTextContent ? elementTextContent.trim().toLowerCase() === 'your cart is empty' : false;
        });
    }
    changeZipCode(zipCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Waiting for zip code change button to become available');
            yield page.waitForSelector('.change-zipcode-link');
            logger_1.logger.info('Changing zip code...');
            yield page.click('.change-zipcode-link');
            yield page.focus('.update-zip__zip-input');
            yield page.type('.update-zip__zip-input', zipCode);
            yield page.press('.update-zip__zip-input', 'Enter');
            logger_1.logger.info('Waiting for zip code to be updated');
            yield page.waitForFunction((zipCode) => {
                const element = document.querySelector('.change-zipcode-link');
                if (!!element) {
                    const { textContent } = element;
                    return (textContent === null || textContent === void 0 ? void 0 : textContent.trim()) === zipCode;
                }
            }, zipCode, { polling: 200 });
        });
    }
    clickCheckoutButton() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Trying to checkout...');
            yield page.click('.checkout-buttons__checkout button:not(disabled)');
        });
    }
    continueAsGuest() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Continuing as guest');
            yield page.click('.cia-guest-content .js-cia-guest-button');
            yield page.waitForSelector('.checkout__container .fulfillment');
        });
    }
    submitGuestOrder() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            const customerInformation = configs_1.getCustomerInformation();
            const paymentInformation = configs_1.getPaymentInformation();
            logger_1.logger.info('Started order information completion');
            yield this.completeShippingInformation(customerInformation);
            yield this.completeContactInformation(customerInformation);
            yield page.screenshot({
                path: path_1.resolve(`screenshots/${Date.now()}_first-information-page-completed.png`),
                type: 'png',
                fullPage: true
            });
            logger_1.logger.info('Continuing to payment screen...');
            yield page.click('.button--continue button');
            yield this.completePaymentInformation(paymentInformation);
            yield page.screenshot({
                path: path_1.resolve(`screenshots/${Date.now()}_second-information-page-completed.png`),
                type: 'png',
                fullPage: true
            });
            logger_1.logger.info('Performing last validation before placing order...');
            const placeOrderButton = yield page.$('.button--place-order button.btn-primary');
            const totalContainer = yield page.$('.order-summary__price > span');
            const totalContainerTextContent = yield (totalContainer === null || totalContainer === void 0 ? void 0 : totalContainer.textContent());
            const parsedTotal = totalContainerTextContent ? parseFloat(totalContainerTextContent.replace('$', '')) : 0;
            if (parsedTotal === 0 || parsedTotal > customerInformation.budget)
                throw new Error('Total amount does not seems right, aborting');
            logger_1.logger.info('Placing order...');
            const placingOrderScreenshotPath = path_1.resolve(`screenshots/${Date.now()}_placing-order.png`);
            yield page.screenshot({
                path: placingOrderScreenshotPath,
                type: 'png',
                fullPage: true
            });
            yield Promise.all([
                discord_1.sendMessage({ message: `Placing order...`, image: placingOrderScreenshotPath }),
            ]);
            if (fs_1.existsSync('purchase.json')) {
                logger_1.logger.warn('Purchase already completed, ending process');
                process.exit(2);
            }
            // *** UNCOMMENT THIS SECTION TO ENABLE AUTO-CHECKOUT ***
            // if (!!placeOrderButton) {
            //   await page.click('.button--place-order button.btn-primary');
            // }
            yield exports.wait(3000);
            logger_1.logger.info('Order placed!');
            if (!fs_1.existsSync('purchase.json'))
                fs_1.writeFileSync('purchase.json', '{}');
            const orderPlacedScreenshotPath = path_1.resolve(`screenshots/${Date.now()}_order-placed-1.png`);
            yield page.screenshot({
                path: orderPlacedScreenshotPath,
                type: 'png',
                fullPage: true
            });
            yield Promise.all([
                discord_1.sendMessage({ message: `Order placed!`, image: orderPlacedScreenshotPath }),
            ]);
            yield exports.wait(3000);
            yield page.screenshot({
                path: path_1.resolve(`screenshots/${Date.now()}_order-placed-2.png`),
                type: 'png',
                fullPage: true
            });
            yield exports.wait(14000);
        });
    }
    completeShippingInformation(customerInformation) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Filling shipping information...');
            yield page.type('[id="consolidatedAddresses.ui_address_2.firstName"]', customerInformation.firstName);
            yield page.type('[id="consolidatedAddresses.ui_address_2.lastName"]', customerInformation.lastName);
            const hideSuggestionsButton = yield page.$('.address-form__cell .autocomplete__toggle');
            const hideSuggestionsButtonTextContent = yield (hideSuggestionsButton === null || hideSuggestionsButton === void 0 ? void 0 : hideSuggestionsButton.textContent());
            if ((hideSuggestionsButtonTextContent === null || hideSuggestionsButtonTextContent === void 0 ? void 0 : hideSuggestionsButtonTextContent.trim().toLocaleLowerCase()) === 'hide suggestions')
                yield page.click('.address-form__cell .autocomplete__toggle');
            yield page.type('[id="consolidatedAddresses.ui_address_2.street"]', customerInformation.address);
            if (customerInformation.addressSecondLine) {
                yield page.click('.address-form__showAddress2Link');
                yield page.type('[id="consolidatedAddresses.ui_address_2.street2"]', customerInformation.addressSecondLine);
            }
            yield page.type('[id="consolidatedAddresses.ui_address_2.city"]', customerInformation.city);
            yield page.selectOption('[id="consolidatedAddresses.ui_address_2.state"]', customerInformation.state);
            yield page.type('[id="consolidatedAddresses.ui_address_2.zipcode"]', customerInformation.zipcode);
            yield page.uncheck('[id="save-for-billing-address-ui_address_2"]');
            logger_1.logger.info('Shipping information completed');
        });
    }
    completeContactInformation(customerInformation) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Filling contact information...');
            yield page.type('[id="user.emailAddress"]', customerInformation.email);
            yield page.type('[id="user.phone"]', customerInformation.phone);
            yield page.check('#text-updates');
            logger_1.logger.info('Contact information completed');
        });
    }
    completePaymentInformation(paymentInformation) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.getPage();
            logger_1.logger.info('Filling payment information...');
            yield page.waitForSelector('.payment');
            yield page.type('#optimized-cc-card-number', paymentInformation.creditCardNumber);
            yield page.selectOption('[name="expiration-month"]', paymentInformation.expirationMonth);
            yield page.selectOption('[name="expiration-year"]', paymentInformation.expirationYear);
            yield page.type('#credit-card-cvv', paymentInformation.cvv);
            yield page.type('[id="payment.billingAddress.firstName"]', paymentInformation.firstName);
            yield page.type('[id="payment.billingAddress.lastName"]', paymentInformation.lastName);
            yield page.type('[id="payment.billingAddress.street"]', paymentInformation.address);
            yield page.type('[id="payment.billingAddress.city"]', paymentInformation.city);
            yield page.type('[id="payment.billingAddress.state"]', paymentInformation.state);
            yield page.type('[id="payment.billingAddress.zipcode"]', paymentInformation.zipcode);
            logger_1.logger.info('Payment information completed');
        });
    }
    getPage() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.page;
        });
    }
}
exports.BestBuy = BestBuy;
