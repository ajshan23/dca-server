"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const roles_1 = require("../constant/roles");
const router = express_1.default.Router();
router.get("/", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), userController_1.getAllUsers);
router.get("/me", authMiddleware_1.authenticateJWT, userController_1.getCurrentUser);
router.get("/check-username", userController_1.checkUsernameAvailability);
router.get("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), userController_1.getUserById);
router.put("/:id", authMiddleware_1.authenticateJWT, userController_1.updateUser);
router.patch("/:id/role", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.SUPER_ADMIN), userController_1.updateUserRole);
router.delete("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.SUPER_ADMIN), userController_1.deleteUser);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map