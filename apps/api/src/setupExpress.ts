import express, { type RequestHandler } from "express";

/** Forward async route rejections to Express error middleware (Express 4 does not; an uncaught throw used to crash the API). */
function wrapAsync(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function wrapHandlers(handlers: unknown[]): unknown[] {
  return handlers.map((h) => {
    if (Array.isArray(h)) return wrapHandlers(h);
    if (typeof h !== "function" || h.length >= 4) return h;
    return wrapAsync(h as RequestHandler);
  });
}

// Every app.get/router.post/... ends up in Route.prototype[method], so patching there covers both.
const methods = ["get", "post", "put", "patch", "delete", "all"] as const;
const RouteProto = (express as unknown as { Route: { prototype: Record<string, (...a: unknown[]) => unknown> } }).Route.prototype;

for (const method of methods) {
  const original = RouteProto[method];
  if (typeof original !== "function") continue;
  RouteProto[method] = function (this: unknown, ...handlers: unknown[]) {
    return original.apply(this, wrapHandlers(handlers));
  };
}
