import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  generateProductQr,
  getAssignedProducts,
  addStock,
  updateInventoryItem,
  getAvailableInventory,
  deleteInventoryItem,
  getStockTransactions,
  generateInventoryQr,
  getStockSummary,
  exportProductsToExcel
} from "../controllers/productController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";
import { UserRole } from "../constant/roles";

const router = express.Router();

// Product template routes
router.post("/", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), createProduct);
router.get("/", getAllProducts);
router.get("/assigned", getAssignedProducts); // Legacy route
router.get("/export/excel", authenticateJWT, exportProductsToExcel);
router.get("/stock-summary", authenticateJWT, getStockSummary);
router.get("/:id", getProductById);
router.put("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), updateProduct);
router.delete("/:id", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), deleteProduct);
router.post("/:id/generate-qr", authenticateJWT, generateProductQr);

// Inventory management routes
router.post("/:id/add-stock", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), addStock);
router.get("/:productId/available-inventory", authenticateJWT, getAvailableInventory);

// Inventory item routes
router.put("/inventory/:inventoryId", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), updateInventoryItem);
router.delete("/inventory/:inventoryId", authenticateJWT, authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.USER), deleteInventoryItem);
router.post("/inventory/:inventoryId/generate-qr", authenticateJWT, generateInventoryQr);

// Stock transaction routes
router.get("/transactions/history", authenticateJWT, getStockTransactions);

export default router;