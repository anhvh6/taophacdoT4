import express from "express";
import { createServer as createViteServer } from "vite";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runYoutubeAutomation } from "./src/services/youtubeAutomation.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Supabase mock removed
  // const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  // const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  // const supabase = createClient(supabaseUrl, supabaseKey);

  // Dynamic Meta Tags for Zalo/Social Media Previews
  app.get("/client/:id", async (req, res) => {
    const customerId = req.params.id;
    let customerName = customerId !== 'NEW' ? 'Học Viên VIP (Mock)' : '';

    const indexPath = process.env.NODE_ENV === "production" 
      ? path.join(__dirname, "dist", "index.html")
      : path.join(__dirname, "index.html");

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, "utf8");
      if (customerName) {
        const title = `Phác đồ trẻ hóa ${customerName.toUpperCase()}`;
        // Replace title and og:title with robust regex
        html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
        html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
      }
      res.send(html);
    } else {
      // Fallback to standard SPA serving if index not found at specific path
      res.sendFile(path.join(__dirname, process.env.NODE_ENV === "production" ? "dist" : "", "index.html"));
    }
  });

  // MOCK: Disabled Migration Endpoints for Local Mocks
  
  // Endpoint điều khiển Youtube Puppeteer
  app.post("/api/youtube/action", async (req, res) => {
    try {
      const { action, email, links } = req.body;
      if (!action || !email || !links || !Array.isArray(links)) {
        return res.status(400).json({ error: "Thiếu tham số" });
      }

      console.log(`[Youtube Backend] Nhận lệnh ${action} cho email ${email} với ${links.length} video.`);
      const result = await runYoutubeAutomation(action, email, links);
      res.json(result);
    } catch (e: any) {
      console.error("[Youtube Backend] Lỗi server:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
