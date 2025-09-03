import { Request, Response } from "express";
export declare function createEmployee(req: Request, res: Response): Promise<void>;
export declare function getAllEmployees(req: Request, res: Response): Promise<void>;
export declare function getEmployeeById(req: Request, res: Response): Promise<void>;
export declare function updateEmployee(req: Request, res: Response): Promise<void>;
export declare function deleteEmployee(req: Request, res: Response): Promise<void>;
