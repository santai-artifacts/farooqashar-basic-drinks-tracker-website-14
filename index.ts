import Database from "bun:sqlite";
import { mkdirSync } from "fs";

mkdirSync(`${import.meta.dir}/data`, { recursive: true });

const db = new Database(
  process.env.DATABASE_URL || `${import.meta.dir}/data/app.db`
);

db.exec(`
  CREATE TABLE IF NOT EXISTS drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL,
    unit TEXT DEFAULT 'oz',
    logged_at TEXT NOT NULL
  )
`);

const publicDir = `${import.meta.dir}/public`;

export default {
  port: process.env.PORT || 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      if (path === "/api/drinks" && req.method === "GET") {
        const date =
          url.searchParams.get("date") ||
          new Date().toISOString().split("T")[0];
        const drinks = db
          .query(
            `SELECT * FROM drinks WHERE date(logged_at) = date(?) ORDER BY logged_at DESC`
          )
          .all(date);
        return Response.json(drinks);
      }

      if (path === "/api/drinks" && req.method === "POST") {
        const body = await req.json();
        if (!body.name?.trim()) {
          return Response.json({ error: "Name required" }, { status: 400 });
        }
        const logged_at = new Date().toISOString();
        const result = db
          .prepare(
            `INSERT INTO drinks (name, amount, unit, logged_at) VALUES (?, ?, ?, ?)`
          )
          .run(
            body.name.trim(),
            body.amount ?? null,
            body.unit || "oz",
            logged_at
          );
        const drink = db
          .query("SELECT * FROM drinks WHERE id = ?")
          .get(result.lastInsertRowid);
        return Response.json(drink);
      }

      const deleteMatch = path.match(/^\/api\/drinks\/(\d+)$/);
      if (deleteMatch && req.method === "DELETE") {
        db.prepare("DELETE FROM drinks WHERE id = ?").run(
          parseInt(deleteMatch[1])
        );
        return Response.json({ success: true });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const filePath =
      path === "/" ? `${publicDir}/index.html` : `${publicDir}${path}`;
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);

    return new Response("Not found", { status: 404 });
  },
};
