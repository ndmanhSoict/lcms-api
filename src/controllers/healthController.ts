import { Request, Response } from "express";

export function getHealth(req: Request, res: Response): void {
  res.json({ status: "ok", uptime: process.uptime() });
}
