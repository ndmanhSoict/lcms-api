import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});
