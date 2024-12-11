const express = require("express");
const bodyParser = require("body-parser");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json()); // Parse JSON payloads

/**
 * Generate a QR code with a central logo.
 *
 * @param {string} dataForQRcode - The data to encode in the QR code.
 * @param {string} center_image - The base64 or file path of the central image.
 * @param {number} width - The width of the QR code canvas.
 * @param {number} logoWidth - The width of the logo image.
 * @param {number} logoHeight - The height of the logo image.
 * @returns {Promise<string>} - A promise that resolves to a base64 string of the QR code.
 */
async function generateQRCodeWithLogo(dataForQRcode, center_image, width) {
  try {
    const canvas = createCanvas(width, width);

    // Generate QR code on the canvas
    await QRCode.toCanvas(canvas, dataForQRcode, {
      errorCorrectionLevel: "H", // High error correction for better logo integration
      margin: 1, // Adjust margin
      color: {
        dark: "#000000", // QR code dark color
        light: "#ffffff", // QR code light background color
      },
    });

    const ctx = canvas.getContext("2d");

    // Load the logo image and get its dimensions
    const img = await loadImage(center_image);
    const logoWidth = img.width;
    const logoHeight = img.height;

    // Resize logo if it's too large
    const maxLogoWidth = width / 5; // Maximum width
    const maxLogoHeight = width / 5; // Maximum height
    let logoWidthFinal = logoWidth;
    let logoHeightFinal = logoHeight;

    if (logoWidth > maxLogoWidth) {
      logoWidthFinal = maxLogoWidth;
      logoHeightFinal = (logoHeight / logoWidth) * maxLogoWidth; // Maintain aspect ratio
    }
    if (logoHeightFinal > maxLogoHeight) {
      logoHeightFinal = maxLogoHeight;
      logoWidthFinal = (logoWidth / logoHeight) * maxLogoHeight; // Maintain aspect ratio
    }

    // Calculate center position for the logo
    const x = Math.round((width - logoWidthFinal) / 2);
    const y = Math.round((width - logoHeightFinal) / 2);

    // Draw the logo on the QR code
    ctx.drawImage(img, x, y, logoWidthFinal, logoHeightFinal);

    // Return the QR code as a base64 string
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}


/**
 * Generate a QR code without a logo.
 *
 * @param {string} data - The data to encode in the QR code.
 * @param {number} width - The width of the QR code canvas.
 * @returns {Promise<string>} - A promise that resolves to a base64 string of the QR code.
 */
async function generateQRCodeWithoutLogo(data, width) {
  const canvas = createCanvas(width, width);

  await QRCode.toCanvas(canvas, data, {
    errorCorrectionLevel: "H",
    margin: 1,
    color: {
      dark: "#000000", // Dark QR code color
      light: "#ffffff", // Light background
    },
  });

  return canvas.toDataURL("image/png");
}

/**
 * API Endpoint to generate a QR code with logo.
 */

app.post("/generate-qr", async (req, res) => {
  try {
    const { data, enableLogo = true } = req.body;

    if (!data) {
      return res.status(400).json({ error: "Missing required field: data" });
    }

    let qrCodeBase64;
    if (enableLogo) {
      const logoPath = "./src/images/logo1.jpg"; // Path to your logo file
      qrCodeBase64 = await generateQRCodeWithLogo(data, logoPath, 400); // Generate QR with logo
    } else {
      qrCodeBase64 = await generateQRCodeWithoutLogo(data, 400); // Generate QR without logo
    }

    // Convert base64 to binary buffer
    const base64Data = qrCodeBase64.replace(/^data:image\/png;base64,/, "");
    const qrCodeBuffer = Buffer.from(base64Data, "base64");

    // Save the QR code image to a directory
    const outputDir = path.join(__dirname, "output"); // Directory to save images
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir); // Create directory if it doesn't exist
    }

    const outputFileName = `qr-code-${Date.now()}.png`; // Unique filename
    const outputPath = path.join(outputDir, outputFileName);

    fs.writeFileSync(outputPath, qrCodeBuffer); // Write the file

    console.log(`QR code saved to: ${outputPath}`);

    // Set response headers to indicate a PNG image
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "inline; filename=qr-code.png");

    // Send the image buffer as a response
    res.send(qrCodeBuffer);
  } catch (error) {
    console.error("Error in /generate-qr:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});



// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
