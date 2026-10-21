import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { settleThroughSchoolStack } from "./src/lib/balabet/school-bridge.server.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Rota de liquidação escolar via PHP e Java
  app.post("/api/settle", async (req, res) => {
    try {
      const result = await settleThroughSchoolStack(req.body);
      return res.status(result.status).json(result.json);
    } catch {
      return res.status(503).json({
        ok: false,
        code: "engine_unavailable",
        error: "Motor PHP/Java indisponível.",
      });
    }
  });

  // Verificação de saúde da aplicação
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "BalaBet" });
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BalaBet servidor ativo na porta ${PORT}`);
  });
}

startServer();
