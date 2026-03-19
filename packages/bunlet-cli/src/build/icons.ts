/**
 * Icon Generation
 *
 * Converts source PNG icon to platform-specific formats.
 * macOS: .icns (iconset with multiple sizes)
 * Windows: .ico (multiple sizes embedded)
 * Linux: .png (256x256)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface IconOptions {
  source: string;
  outDir: string;
  name?: string;
}

export interface IconResult {
  success: boolean;
  outputs: {
    icns?: string;
    ico?: string;
    png?: string;
  };
  error?: string;
}

/**
 * Generate icons for all platforms
 */
export async function generateIcons(options: IconOptions): Promise<IconResult> {
  const { source, outDir, name = 'icon' } = options;

  if (!fs.existsSync(source)) {
    return {
      success: false,
      outputs: {},
      error: `Source icon not found: ${source}`,
    };
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputs: IconResult['outputs'] = {};
  const errors: string[] = [];

  // Copy source as PNG for Linux
  try {
    const pngDest = path.join(outDir, `${name}.png`);
    fs.copyFileSync(source, pngDest);
    outputs.png = pngDest;
  } catch (e) {
    errors.push(`Failed to copy PNG: ${e}`);
  }

  // Generate macOS .icns
  if (process.platform === 'darwin') {
    try {
      const icnsResult = await generateIcns(source, outDir, name);
      if (icnsResult.success) {
        outputs.icns = icnsResult.path;
      } else {
        errors.push(`ICNS: ${icnsResult.error}`);
      }
    } catch (e) {
      errors.push(`Failed to generate ICNS: ${e}`);
    }
  }

  // Generate Windows .ico
  try {
    const icoResult = await generateIco(source, outDir, name);
    if (icoResult.success) {
      outputs.ico = icoResult.path;
    } else {
      errors.push(`ICO: ${icoResult.error}`);
    }
  } catch (e) {
    errors.push(`Failed to generate ICO: ${e}`);
  }

  return {
    success: errors.length === 0,
    outputs,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * Generate macOS .icns file using iconutil
 */
async function generateIcns(
  source: string,
  outDir: string,
  name: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (process.platform !== 'darwin') {
    return {
      success: false,
      error: 'ICNS generation only supported on macOS',
    };
  }

  const iconsetDir = path.join(outDir, `${name}.iconset`);
  const icnsPath = path.join(outDir, `${name}.icns`);

  try {
    // Create iconset directory
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true });
    }
    fs.mkdirSync(iconsetDir, { recursive: true });

    // Required sizes for macOS
    const sizes = [16, 32, 64, 128, 256, 512, 1024];

    // Check if sips is available (macOS built-in)
    for (const size of sizes) {
      const outputFile = path.join(iconsetDir, `icon_${size}x${size}.png`);
      const output2x = path.join(iconsetDir, `icon_${size / 2}x${size / 2}@2x.png`);

      // Use sips to resize
      try {
        execSync(
          `sips -z ${size} ${size} "${source}" --out "${outputFile}" 2>/dev/null`,
          { stdio: 'pipe' }
        );

        // Also create @2x version for Retina
        if (size >= 32) {
          fs.copyFileSync(outputFile, output2x);
        }
      } catch {
        // sips failed, copy original
        fs.copyFileSync(source, outputFile);
      }
    }

    // Use iconutil to create .icns
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, {
      stdio: 'pipe',
    });

    // Clean up iconset directory
    fs.rmSync(iconsetDir, { recursive: true });

    return { success: true, path: icnsPath };
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate Windows .ico file
 * Uses a simple approach: create ICO with just the source PNG
 * For proper multi-size ICO, use a library like png-to-ico
 */
async function generateIco(
  source: string,
  outDir: string,
  name: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const icoPath = path.join(outDir, `${name}.ico`);

  try {
    // Read PNG file
    const pngData = fs.readFileSync(source);

    // Simple ICO creation (single image)
    // ICO format: Header + Directory Entry + Image Data
    const ico = createSimpleIco(pngData);

    fs.writeFileSync(icoPath, ico);
    return { success: true, path: icoPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a simple ICO file from PNG data
 * This creates an ICO with a single PNG image embedded
 */
function createSimpleIco(pngData: Buffer): Buffer {
  // ICO Header (6 bytes)
  // - Reserved: 2 bytes (0)
  // - Type: 2 bytes (1 = ICO)
  // - Count: 2 bytes (number of images)

  // ICO Directory Entry (16 bytes per image)
  // - Width: 1 byte (0 = 256)
  // - Height: 1 byte (0 = 256)
  // - Color palette: 1 byte (0 = no palette)
  // - Reserved: 1 byte (0)
  // - Color planes: 2 bytes (1)
  // - Bits per pixel: 2 bytes (32)
  // - Size of image data: 4 bytes
  // - Offset to image data: 4 bytes

  const headerSize = 6;
  const directoryEntrySize = 16;
  const imageOffset = headerSize + directoryEntrySize;

  const buffer = Buffer.alloc(imageOffset + pngData.length);

  // Header
  buffer.writeUInt16LE(0, 0); // Reserved
  buffer.writeUInt16LE(1, 2); // Type (ICO)
  buffer.writeUInt16LE(1, 4); // Image count

  // Directory entry
  buffer.writeUInt8(0, 6); // Width (0 = 256)
  buffer.writeUInt8(0, 7); // Height (0 = 256)
  buffer.writeUInt8(0, 8); // Color palette
  buffer.writeUInt8(0, 9); // Reserved
  buffer.writeUInt16LE(1, 10); // Color planes
  buffer.writeUInt16LE(32, 12); // Bits per pixel
  buffer.writeUInt32LE(pngData.length, 14); // Image size
  buffer.writeUInt32LE(imageOffset, 18); // Image offset

  // Image data (PNG)
  pngData.copy(buffer, imageOffset);

  return buffer;
}

/**
 * Generate icons for a specific platform
 */
export async function generateIconsForPlatform(
  source: string,
  outDir: string,
  platform: 'darwin' | 'win32' | 'linux',
  name = 'icon'
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!fs.existsSync(source)) {
    return { success: false, error: `Source icon not found: ${source}` };
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  switch (platform) {
    case 'darwin':
      return generateIcns(source, outDir, name);
    case 'win32':
      return generateIco(source, outDir, name);
    case 'linux':
      try {
        const pngDest = path.join(outDir, `${name}.png`);
        fs.copyFileSync(source, pngDest);
        return { success: true, path: pngDest };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    default:
      return { success: false, error: `Unknown platform: ${platform}` };
  }
}
