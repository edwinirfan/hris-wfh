import type { Request } from 'express';

/** IP & user agent diteruskan ke service untuk jejak audit */
export function clientInfo(request: Request): { ip?: string; userAgent?: string } {
  const ip = request.ip?.replace(/^::ffff:/, '').slice(0, 45);
  const userAgent = request.headers['user-agent']?.slice(0, 255);
  return { ip: ip || undefined, userAgent: userAgent || undefined };
}
