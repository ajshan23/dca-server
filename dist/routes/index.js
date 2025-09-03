"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const productRoutes_1 = __importDefault(require("./productRoutes"));
const productAssignmentRoutes_1 = __importDefault(require("./productAssignmentRoutes"));
const employeeRoutes_1 = __importDefault(require("./employeeRoutes"));
const categoryRoutes_1 = __importDefault(require("./categoryRoutes"));
const branchRoutes_1 = __importDefault(require("./branchRoutes"));
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const departmentRoutes_1 = __importDefault(require("./departmentRoutes"));
const seed_1 = require("../database/seed");
const router = express_1.default.Router();
// Health check endpoint
router.get("/health", (_req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date() });
});
router.get("/up/seed", (_req, res) => {
    (0, seed_1.updateSuperAdminRole)();
    res.status(200).json({ status: "OK", timestamp: new Date() });
});
router.get("/seed", (_req, res) => {
    (0, seed_1.main)();
    res.status(200).json({ status: "OK", timestamp: new Date() });
});
// Routes
router.use("/users", userRoutes_1.default);
router.use("/auth", authRoutes_1.default);
router.use("/products", productRoutes_1.default);
router.use("/product-assignments", productAssignmentRoutes_1.default);
router.use("/employees", employeeRoutes_1.default);
router.use("/categories", categoryRoutes_1.default);
router.use("/branches", branchRoutes_1.default);
router.use("/dashboard", dashboardRoutes_1.default);
router.use("/departments", departmentRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map