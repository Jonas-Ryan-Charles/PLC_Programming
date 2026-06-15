// JWT issuing + verification, and the Express middleware that guards routes.
import jwt from "jsonwebtoken";
import { getUserById } from "./db.js";

const SECRET = process.env.VOLTRUNG_JWT_SECRET ?? "dev-secret-change-me";
const TTL = "30d";

export function issueToken(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: TTL });
}

/** Strip a DB user row down to the public profile sent to the client. */
export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

/** Express middleware: require a valid Bearer token, attach req.user. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { uid } = jwt.verify(token, SECRET);
    const user = getUserById(uid);
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
