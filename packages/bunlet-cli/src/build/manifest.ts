/**
 * Manifest Generation
 *
 * Generates platform-specific manifest files.
 * - macOS: Info.plist
 * - Linux: .desktop file
 * - Windows: app.manifest (for UAC, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AppManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  bundleId?: string;
  category?: string;
  copyright?: string;
}

/**
 * Generate macOS Info.plist
 */
export function generateInfoPlist(manifest: AppManifest): string {
  const bundleId = manifest.bundleId || `com.bunlet.${manifest.name.toLowerCase().replace(/\s+/g, '-')}`;
  const copyright = manifest.copyright || `Copyright © ${new Date().getFullYear()} ${manifest.author || 'Bunlet App'}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${manifest.name}</string>
  <key>CFBundleDisplayName</key>
  <string>${manifest.name}</string>
  <key>CFBundleIdentifier</key>
  <string>${bundleId}</string>
  <key>CFBundleVersion</key>
  <string>${manifest.version}</string>
  <key>CFBundleShortVersionString</key>
  <string>${manifest.version}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleSignature</key>
  <string>????</string>
  <key>CFBundleExecutable</key>
  <string>${manifest.name}</string>
  <key>CFBundleIconFile</key>
  <string>app.icns</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
  <key>LSApplicationCategoryType</key>
  <string>${manifest.category || 'public.app-category.utilities'}</string>
  <key>NSHumanReadableCopyright</key>
  <string>${copyright}</string>
  <key>NSMainNibFile</key>
  <string></string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
`;
}

/**
 * Generate Linux .desktop file
 */
export function generateDesktopFile(manifest: AppManifest, execPath: string): string {
  const categories = manifest.category || 'Utility;Application;';

  return `[Desktop Entry]
Name=${manifest.name}
Comment=${manifest.description || manifest.name}
Exec=${execPath}
Icon=${manifest.name.toLowerCase()}
Type=Application
Categories=${categories}
Terminal=false
StartupWMClass=${manifest.name}
`;
}

/**
 * Generate Linux AppImage AppRun script
 */
export function generateAppRun(execName: string): string {
  return `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
export PATH="\${HERE}/usr/bin:\${PATH}"
export LD_LIBRARY_PATH="\${HERE}/usr/lib:\${LD_LIBRARY_PATH}"
exec "\${HERE}/usr/bin/${execName}" "\$@"
`;
}

/**
 * Generate Windows manifest for UAC and DPI awareness
 */
export function generateWindowsManifest(manifest: AppManifest): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity
    version="${manifest.version}.0"
    processorArchitecture="*"
    name="${manifest.name}"
    type="win32"
  />
  <description>${manifest.description || manifest.name}</description>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10/11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
      <!-- Windows 8.1 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/>
      <!-- Windows 8 -->
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}"/>
      <!-- Windows 7 -->
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>
`;
}

/**
 * Write manifest files for a platform
 */
export function writeManifests(
  platform: 'darwin' | 'win32' | 'linux',
  outDir: string,
  manifest: AppManifest
): void {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  switch (platform) {
    case 'darwin':
      fs.writeFileSync(
        path.join(outDir, 'Info.plist'),
        generateInfoPlist(manifest)
      );
      break;

    case 'linux':
      const desktopFile = generateDesktopFile(
        manifest,
        `/usr/bin/${manifest.name.toLowerCase()}`
      );
      fs.writeFileSync(
        path.join(outDir, `${manifest.name.toLowerCase()}.desktop`),
        desktopFile
      );
      break;

    case 'win32':
      fs.writeFileSync(
        path.join(outDir, `${manifest.name}.exe.manifest`),
        generateWindowsManifest(manifest)
      );
      break;
  }
}
