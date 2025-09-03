"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productAssignmentController_1 = require("../controllers/productAssignmentController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const roles_1 = require("../constant/roles");
const router = express_1.default.Router();
router.post("/assign", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productAssignmentController_1.assignProduct);
router.get("/product/:productId", authMiddleware_1.authenticateJWT, productAssignmentController_1.getProductAssignments);
router.post("/return/:assignmentId", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productAssignmentController_1.returnProduct);
router.get("/active", authMiddleware_1.authenticateJWT, productAssignmentController_1.getActiveAssignments);
router.get("/history", authMiddleware_1.authenticateJWT, productAssignmentController_1.getAssignmentHistory);
router.get("/employee/:employeeId", authMiddleware_1.authenticateJWT, productAssignmentController_1.getEmployeeAssignments);
router.put("/:assignmentId", authMiddleware_1.authenticateJWT, productAssignmentController_1.updateAssignment);
// ✅ New route for analytics
router.get("/analytics", authMiddleware_1.authenticateJWT, productAssignmentController_1.getAssignmentAnalytics);
exports.default = router;
//# sourceMappingURL=productAssignmentRoutes.js.map