import express from "express";
import path from "path";
import fs from "fs";
import JSZip from "jszip";

const app = express();
const PORT = 5004;


// Serve public folder
app.use(express.static(path.join(process.cwd(), "public")));

// Serve WTA files for the store
app.use("/wta-store/files", express.static(path.join(process.cwd(), "wta-files")));

// API endpoint to list WTA apps with metadata
app.get("/wta-store/list", async (req, res) => {
    const files = fs.readdirSync("wta-files").filter(f => f.endsWith(".wta"));
    const apps = [];

    for (const file of files) {
        const buffer = fs.readFileSync(path.join("wta-files", file));
        const zip = await JSZip.loadAsync(buffer);
        const metadataFile = zip.file("app_mdata.json");
        if (!metadataFile) continue;

        const content = await metadataFile.async("string");
        const metadata = JSON.parse(content);

        apps.push({
            name: metadata.name || file,
            description: metadata.description || "",
            icon: metadata.icon || "unknown.png",
            file: file
        });
    }

    res.json(apps);
});

// Serve icon from inside .wta zip
app.get("/wta-store/icon/:file", async (req, res) => {
    const wtaFile = req.params.file;
    const wtaPath = path.join("wta-files", wtaFile);

    if (!fs.existsSync(wtaPath)) {
        return res.status(404).send("WTA file not found");
    }

    try {
        const buffer = fs.readFileSync(wtaPath);
        const zip = await JSZip.loadAsync(buffer);

        // Try to get metadata for icon filename
        let iconName = "icon.png";
        const metadataFile = zip.file("app_mdata.json");
        if (metadataFile) {
            const content = await metadataFile.async("string");
            const metadata = JSON.parse(content);
            if (metadata.icon) iconName = metadata.icon;
        }

        const iconFile = zip.file(iconName);
        if (!iconFile) {
            return res.status(404).send("Icon not found in WTA file");
        }

        const iconBuffer = await iconFile.async("nodebuffer");
        // Guess content type by extension
        const ext = path.extname(iconName).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
                    : ext === ".svg" ? "image/svg+xml"
                    : "image/png";
        res.setHeader("Content-Type", mime);
        res.send(iconBuffer);
    } catch (err) {
        res.status(500).send("Error reading WTA file");
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));