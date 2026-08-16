import { Router, type RequestHandler } from "express";

/** Forward async route rejections to Express error middleware (avoids 504 hangs). */
function wrapAsync(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const methods = ["get", "post", "put", "patch", "delete"] as const;

for (const method of methods) {
  const original = Router.prototype[method];
  Router.prototype[method] = function (path: string, ...handlers: RequestHandler[]) {
    const wrapped = handlers.map((h) => {
      if (typeof h !== "function" || h.length >= 4) return h;
      return wrapAsync(h);
    });
    return original.call(this, path, ...wrapped);
  };
}
