"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const branchController_1 = require("../controllers/branchController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const roles_1 = require("../constant/roles");
const router = express_1.default.Router();
router.post("/", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), branchController_1.createBranch);
router.get("/", branchController_1.getAllBranches);
router.get("/:id", branchController_1.getBranchById);
router.put("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), branchController_1.updateBranch);
router.delete("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN), branchController_1.deleteBranch);
exports.default = router;
//# sourceMappingURL=branchRoutes.js.map