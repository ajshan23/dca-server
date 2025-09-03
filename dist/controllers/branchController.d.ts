import { Request, Response } from "express";
export declare function createBranch(req: Request, res: Response): Promise<void>;
export declare function getAllBranches(req: Request, res: Response): Promise<void>;
export declare function getBranchById(req: Request, res: Response): Promise<void>;
export declare function updateBranch(req: Request, res: Response): Promise<void>;
export declare function deleteBranch(req: Request, res: Response): Promise<void>;
