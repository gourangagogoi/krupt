import { Request, Response, NextFunction } from "express";

export function rawBodyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", (err) => next(err));
}
