import type { Request } from "express";

export function queryString(request: Request, key: string): string {
  return String(request.query[key] ?? "").trim();
}

export function bodyString(request: Request, key: string): string {
  const value = request.body?.[key];
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function requireQuery(request: Request, key: string): string {
  const value = queryString(request, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function requireBody(request: Request, key: string): string {
  const value = bodyString(request, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}
