export default {
  main: './main.ts',
  renderer: {
    root: './renderer',
    index: './renderer/index.html',
  },
  build: {
    outDir: './dist',
  },
  package: {
    name: 'Notes App',
    productName: 'Notes App',
    appId: 'com.bunlet.notes-app',
    version: '1.0.0',
    description: 'A beautiful notes app built with Bunlet',
  },
};
