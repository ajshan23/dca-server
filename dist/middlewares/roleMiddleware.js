"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = authorizeRoles;
const errorHandler_1 = require("../samples/errorHandler");
function authorizeRoles(...roles) {
    return (req, _res, next) => {
        if (!req.user) {
            throw new errorHandler_1.AppError("Authentication required", 401);
        }
        if (!roles.includes(req.user.role)) {
            throw new errorHandler_1.AppError("Insufficient permissions", 403);
        }
        next();
    };
}
//# sourceMappingURL=roleMiddleware.js.map