import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { FEEDS, renderFeed } from "./src/lib/feeds.ts";
import type { CalendarData } from "./src/lib/types.ts";

const DATA_PATH = new URL("./data/academic-calendar.json", import.meta.url);
// Optional: the public URL of the site, written into the feeds' URL property.
const SITE_URL = process.env.SITE_URL;

function loadData(): CalendarData {
  return JSON.parse(readFileSync(DATA_PATH, "utf8"));
}

/** Generates the .ics feeds from the committed JSON (served in dev, emitted on build). */
function icsFeeds(): Plugin {
  return {
    name: "ics-feeds",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        const feed = FEEDS.find((f) => path.endsWith(`/${f.file}`));
        if (!feed) return next();
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.end(renderFeed(feed, loadData(), SITE_URL));
      });
    },
    generateBundle() {
      const data = loadData();
      for (const feed of FEEDS) {
        this.emitFile({ type: "asset", fileName: feed.file, source: renderFeed(feed, data, SITE_URL) });
      }
    },
  };
}

export default defineConfig({
  // Relative asset paths work on both Cloudflare Pages (served at /) and
  // GitHub Pages (served at /<repo>/) without configuration.
  base: "./",
  plugins: [react(), icsFeeds()],
});
