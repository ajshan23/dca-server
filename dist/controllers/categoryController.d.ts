import { Request, Response } from "express";
export declare function createCategory(req: Request, res: Response): Promise<void>;
export declare function getAllCategories(req: Request, res: Response): Promise<void>;
export declare function getCategoryById(req: Request, res: Response): Promise<void>;
export declare function updateCategory(req: Request, res: Response): Promise<void>;
export declare function deleteCategory(req: Request, res: Response): Promise<void>;
