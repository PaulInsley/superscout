import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("ServiceToken ")) {
    const serviceToken = authHeader.slice("ServiceToken ".length);
    const expected = process.env.PROCESS_DECISIONS_SECRET;
    if (expected && serviceToken === expected) {
      const serviceUserId = req.headers["x-service-user-id"] as string | undefined;
      if (!serviceUserId) {
        res.status(400).json({ error: "x-service-user-id header required for service calls" });
        return;
      }
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        (req as any).verifiedUserId = serviceUserId;
        (req as any).userSupabase = createClient(supabaseUrl, serviceRoleKey);
      }
      next();
      return;
    }
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Auth service unavailable" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as any).verifiedUserId = user.id;
  (req as any).userSupabase = supabase;
  next();
}
