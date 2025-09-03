import { Request, Response } from "express";
export declare function assignProduct(req: Request, res: Response): Promise<void>;
export declare function returnProduct(req: Request, res: Response): Promise<void>;
export declare function getActiveAssignments(req: Request, res: Response): Promise<void>;
export declare function getAssignmentHistory(req: Request, res: Response): Promise<void>;
export declare function getEmployeeAssignments(req: Request, res: Response): Promise<void>;
export declare function updateAssignment(req: Request, res: Response): Promise<void>;
export declare function getProductAssignments(req: Request, res: Response): Promise<void>;
export declare function getAssignmentAnalytics(req: Request, res: Response): Promise<void>;
