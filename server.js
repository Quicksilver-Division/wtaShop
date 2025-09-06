import { Application, Router, send } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import * as path from "https://deno.land/std@0.203.0/path/mod.ts";
import JSZip from "https://deno.land/x/jszip@3.10.1/mod.ts";
const PORT = 5004;
const app = new Application();
const router = new Router();

// --------------------
// Serve /public folder
// --------------------
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname.startsWith("/public")) {
    await send(ctx, ctx.request.url.pathname, {
      root: Deno.cwd(),
    });
  } else {
    await next();
  }
});

// --------------------
// Serve WTA files directly
// --------------------
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname.startsWith("/wta-store/files/")) {
    const fileName = ctx.request.url.pathname.replace("/wta-store/files/", "");
    await send(ctx, fileName, { root: `${Deno.cwd()}/wta-files` });
  } else {
    await next();
  }
});

// --------------------
// List apps with metadata
// --------------------
router.get("/wta-store/list", async (ctx) => {
  const apps = [];
  for await (const entry of Deno.readDir("wta-files")) {
    if (entry.isFile && entry.name.endsWith(".wta")) {
      const buffer = await Deno.readFile(path.join("wta-files", entry.name));
      const zip = await JSZip.loadAsync(buffer);
      const metadataFile = zip.file("app_mdata.json");
      if (!metadataFile) continue;
      const content = await metadataFile.async("string");
      const metadata = JSON.parse(content);

      apps.push({
        name: metadata.name || entry.name,
        description: metadata.description || "",
        icon: metadata.icon || "unknown.png",
        file: entry.name,
      });
    }
  }
  ctx.response.body = apps;
});

// --------------------
// Serve icon from .wta zip
// --------------------
router.get("/wta-store/icon/:file", async (ctx) => {
  const wtaFile = ctx.params.file;
  const wtaPath = path.join("wta-files", wtaFile);

  try {
    await Deno.stat(wtaPath);
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "WTA file not found";
    return;
  }

  const buffer = await Deno.readFile(wtaPath);
  const zip = await JSZip.loadAsync(buffer);

  // Default icon name
  let iconName = "icon.png";

  // Check metadata for icon
  const metadataFile = zip.file("app_mdata.json");
  if (metadataFile) {
    const content = await metadataFile.async("string");
    const metadata = JSON.parse(content);
    if (metadata.icon) iconName = metadata.icon;
  }

  const iconFile = zip.file(iconName);
  if (!iconFile) {
    ctx.response.status = 404;
    ctx.response.body = "Icon not found in WTA file";
    return;
  }

  const iconBuffer = await iconFile.async("uint8array");

  const ext = path.extname(iconName).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg"
    ? "image/jpeg"
    : ext === ".svg"
      ? "image/svg+xml"
      : "image/png";

  ctx.response.headers.set("Content-Type", mime);
  ctx.response.body = iconBuffer;
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server running at http://localhost:${PORT}`);
await app.listen({ port: PORT });
