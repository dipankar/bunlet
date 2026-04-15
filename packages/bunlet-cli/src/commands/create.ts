/**
 * bunlet create command
 *
 * Creates a new Bunlet application from a template.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';

const cliPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));

interface CreateOptions {
  template: string;
  webview: 'system' | 'cef';
  typescript: boolean;
  git: boolean;
  install: boolean;
}

/**
 * Create a new Bunlet application
 */
export async function createCommand(
  appName: string,
  options: CreateOptions
): Promise<void> {
  if (options.webview !== 'system' && options.webview !== 'cef') {
    console.error(`Error: Unsupported webview engine "${options.webview}". Use "system" or "cef".`);
    process.exit(1);
  }

  if (options.template !== 'default') {
    console.error(
      `Error: Unsupported template "${options.template}". Currently supported: default`
    );
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), appName);

  console.log(`\nCreating Bunlet app: ${appName}`);
  console.log(`Template: ${options.template}`);
  console.log(`WebView: ${options.webview}`);
  console.log(`TypeScript: ${options.typescript}`);
  console.log(`Directory: ${targetDir}\n`);

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    console.error(`Error: Directory "${appName}" already exists`);
    process.exit(1);
  }

  // Create directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Create package.json
  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'bunlet dev',
      build: 'bunlet build',
      package: 'bunlet package',
    },
    dependencies: {
      bunlet: `^${cliPkg.version}`,
    },
    devDependencies: options.typescript
      ? {
          typescript: '^5.3.0',
          '@types/node': '^20.0.0',
        }
      : {},
  };

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create main process file
  const mainContent = options.typescript
    ? `import { app, BrowserWindow } from 'bunlet';
import { z } from 'bunlet';
import * as path from 'path';

// Register handlers/events before app startup
app.handle('greet', z.object({ name: z.string() }), async ({ name }) => {
  return \`Hello, \${name}! Welcome to ${appName}!\`;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Wait for app to be ready, create windows, then start event loop
await app.whenReady();

const win = new BrowserWindow({
  width: 1200,
  height: 800,
  title: '${appName}',
});

// Load the renderer
if (process.env.NODE_ENV === 'development') {
  // Dev mode: load from dev server
  win.loadURL('http://localhost:5173');
} else {
  // Production: load from file
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.run();
`
    : `import { app, BrowserWindow, z } from 'bunlet';
import * as path from 'path';

app.handle('greet', z.object({ name: z.string() }), async ({ name }) => {
  return \`Hello, \${name}! Welcome to ${appName}!\`;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

await app.whenReady();

const win = new BrowserWindow({
  width: 1200,
  height: 800,
  title: '${appName}',
});

if (process.env.NODE_ENV === 'development') {
  win.loadURL('http://localhost:5173');
} else {
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.run();
`;

  const mainExt = options.typescript ? '.ts' : '.js';
  fs.writeFileSync(path.join(targetDir, `main${mainExt}`), mainContent);

  // Create renderer directory and index.html
  const rendererDir = path.join(targetDir, 'renderer');
  fs.mkdirSync(rendererDir, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }
    button {
      background: white;
      color: #667eea;
      border: none;
      padding: 1rem 2rem;
      font-size: 1rem;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    #result {
      margin-top: 1rem;
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${appName}</h1>
    <p>Built with Bunlet - Fast Desktop Apps with Bun</p>
    <button onclick="greet()">Say Hello</button>
    <p id="result"></p>
  </div>
  <script>
    async function greet() {
      const result = await window.__bunlet.invoke({
        method: 'greet',
        params: { name: 'World' }
      });
      document.getElementById('result').textContent = String(result ?? '');
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(rendererDir, 'index.html'), htmlContent);

  // Create tsconfig.json if TypeScript
  if (options.typescript) {
    const tsConfig = {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: './dist',
        rootDir: '.',
      },
      include: ['*.ts', 'renderer/**/*.ts'],
      exclude: ['node_modules', 'dist'],
    };

    fs.writeFileSync(
      path.join(targetDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  // Create bunlet.config.ts
  const configContent = options.typescript
    ? `import { defineConfig } from 'bunlet/config';

export default defineConfig({
  main: './main.ts',
  renderer: {
    root: './renderer',
    index: './renderer/index.html',
  },
  webview: {
    engine: '${options.webview}',
  },
  build: {
    outDir: './dist',
  },
});
`
    : `module.exports = {
  main: './main.js',
  renderer: {
    root: './renderer',
    index: './renderer/index.html',
  },
  webview: {
    engine: '${options.webview}',
  },
  build: {
    outDir: './dist',
  },
};
`;

  const configExt = options.typescript ? '.ts' : '.js';
  fs.writeFileSync(
    path.join(targetDir, `bunlet.config${configExt}`),
    configContent
  );

  // Initialize git if requested
  if (options.git) {
    try {
      const { execSync } = await import('child_process');
      execSync('git init', { cwd: targetDir, stdio: 'pipe' });

      // Create .gitignore
      const gitignore = `node_modules/
dist/
*.log
.DS_Store
`;
      fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignore);

      console.log('Initialized git repository');
    } catch (e) {
      console.log('Git initialization skipped (git not available)');
    }
  }

  // Install dependencies if requested
  if (options.install) {
    console.log('Installing dependencies...');
    try {
      const { execSync } = await import('child_process');
      execSync('bun install', { cwd: targetDir, stdio: 'inherit' });
    } catch (e) {
      console.log('Dependency installation failed. Run "bun install" manually.');
    }
  }

  console.log(`
Done! Created ${appName} at ${targetDir}

Next steps:
  cd ${appName}
  ${options.install ? '' : 'bun install\n  '}bunlet dev

Happy coding!
`);
}
