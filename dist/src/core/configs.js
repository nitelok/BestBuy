"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationsInformation = exports.getPaymentInformation = exports.getCustomerInformation = exports.getTasks = void 0;
const tasks_json_1 = __importDefault(require("@config/prod/tasks.json"));
const customer_json_1 = __importDefault(require("@config/prod/customer.json"));
const payment_json_1 = __importDefault(require("@config/prod/payment.json"));
const notifications_json_1 = __importDefault(require("@config/prod/notifications.json"));
exports.getTasks = () => {
    return tasks_json_1.default;
};
exports.getCustomerInformation = () => {
    return customer_json_1.default;
};
exports.getPaymentInformation = () => {
    return payment_json_1.default;
};
exports.getNotificationsInformation = () => {
    return notifications_json_1.default;
};
