import express from "express";
import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import productRoutes from "./productRoutes";
import productAssignmentRoutes from "./productAssignmentRoutes";
import employeeRoutes from "./employeeRoutes";
import categoryRoutes from "./categoryRoutes";
import branchRoutes from "./branchRoutes";
import dashboardRoutes from "./dashboardRoutes";
import departmentRoutes from "./departmentRoutes"; 

import {  main, updateSuperAdminRole } from "../database/seed";

const router = express.Router();

// Health check endpoint
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});
router.get("/up/seed", (_req, res) => {
  updateSuperAdminRole();
  res.status(200).json({ status: "OK", timestamp: new Date() });
});
router.get("/seed", (_req, res) => {
  main();
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Routes
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/product-assignments", productAssignmentRoutes);
router.use("/employees", employeeRoutes);
router.use("/categories", categoryRoutes);
router.use("/branches", branchRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/departments", departmentRoutes);
export default router;