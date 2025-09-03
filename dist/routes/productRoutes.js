"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const roles_1 = require("../constant/roles");
const router = express_1.default.Router();
// Product template routes
router.post("/", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.createProduct);
router.get("/", productController_1.getAllProducts);
router.get("/assigned", productController_1.getAssignedProducts); // Legacy route
router.get("/stock-summary", authMiddleware_1.authenticateJWT, productController_1.getStockSummary);
router.get("/:id", productController_1.getProductById);
router.put("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.updateProduct);
router.delete("/:id", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.deleteProduct);
router.post("/:id/generate-qr", authMiddleware_1.authenticateJWT, productController_1.generateProductQr);
// Inventory management routes
router.post("/:id/add-stock", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.addStock);
router.get("/:productId/available-inventory", authMiddleware_1.authenticateJWT, productController_1.getAvailableInventory);
// Inventory item routes
router.put("/inventory/:inventoryId", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.updateInventoryItem);
router.delete("/inventory/:inventoryId", authMiddleware_1.authenticateJWT, (0, roleMiddleware_1.authorizeRoles)(roles_1.UserRole.ADMIN, roles_1.UserRole.SUPER_ADMIN, roles_1.UserRole.USER), productController_1.deleteInventoryItem);
router.post("/inventory/:inventoryId/generate-qr", authMiddleware_1.authenticateJWT, productController_1.generateInventoryQr);
// Stock transaction routes
router.get("/transactions/history", authMiddleware_1.authenticateJWT, productController_1.getStockTransactions);
exports.default = router;
//# sourceMappingURL=productRoutes.js.map