"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
const errorHandler_1 = require("../samples/errorHandler");
function validateRequest(schema) {
    return (req, _res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return next(new errorHandler_1.AppError(error.details[0].message, 400));
        }
        next();
    };
}
//# sourceMappingURL=validationMiddleware.js.map