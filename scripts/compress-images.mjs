import sharp from "sharp";
import fs from "fs";
import path from "path";

const files = [
  "public/images/steps/1.png",
  "public/images/steps/2.png",
  "public/images/steps/3.png",
  "public/images/steps/4.png",
  "public/aquaforceforautocare/images/steps/1.png",
  "public/aquaforceforautocare/images/steps/2.png",
  "public/aquaforceforautocare/images/steps/3.png",
  "public/aquaforceforautocare/images/steps/4.png",
  "public/images/Hero section Images/mobile banner 3.png",
  "public/images/Hero section Images/mobile banner 6.png",
  "public/images/Remainig images/Promec Tools WhatsApp Template 1.png",
  "public/images/amec-shield-logo.png",
];

async function run() {
  for (const f of files) {
    if (fs.existsSync(f)) {
      const outWebp = f.replace(/\.png$/, ".webp");
      const origSize = fs.statSync(f).size;
      await sharp(f).webp({ quality: 85 }).toFile(outWebp);
      const newSize = fs.statSync(outWebp).size;
      console.log(
        `Converted ${path.basename(f)}: ${(origSize / 1024 / 1024).toFixed(2)} MB -> ${(newSize / 1024).toFixed(1)} KB (${((1 - newSize / origSize) * 100).toFixed(1)}% reduction)`
      );
    }
  }
}

run();
