// Native addon loader for bunlet-native
// Loads the correct platform-specific binary

const { platform, arch } = process;

let nativeBinding = null;
let loadError = null;

function getBindingPath() {
  const platformArch = `${platform}-${arch}`;

  const bindings = {
    'linux-x64': 'bunlet-native.linux-x64-gnu.node',
    'linux-arm64': 'bunlet-native.linux-arm64-gnu.node',
    'darwin-x64': 'bunlet-native.darwin-x64.node',
    'darwin-arm64': 'bunlet-native.darwin-arm64.node',
    'win32-x64': 'bunlet-native.win32-x64-msvc.node',
  };

  const binding = bindings[platformArch];
  if (!binding) {
    throw new Error(`Unsupported platform: ${platformArch}`);
  }

  return `./${binding}`;
}

try {
  const bindingPath = getBindingPath();
  nativeBinding = require(bindingPath);
} catch (e) {
  loadError = e;
}

if (!nativeBinding) {
  throw loadError || new Error('Failed to load native binding');
}

module.exports = nativeBinding;
