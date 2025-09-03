"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/categoryController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const roles_1 = require("../constant/roles");
const router = express_1.default.Router();
router.post("/", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), categoryController_1.createCategory);
router.get("/", categoryController_1.getAllCategories);
router.get("/:id", categoryController_1.getCategoryById);
router.put("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), categoryController_1.updateCategory);
router.delete("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), categoryController_1.deleteCategory);
exports.default = router;
//# sourceMappingURL=categoryRoutes.js.map