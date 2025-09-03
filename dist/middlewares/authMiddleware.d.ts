import { Request, Response, NextFunction } from "express";
export declare function authenticateJWT(req: Request, _res: Response, next: NextFunction): Promise<void>;
