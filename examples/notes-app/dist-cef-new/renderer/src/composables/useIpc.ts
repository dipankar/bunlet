/**
 * IPC event handling composable
 */

import { onMounted, onUnmounted, ref } from 'vue';

type MenuHandler = () => void;

const menuHandlers = new Map<string, MenuHandler>();

// Handle incoming IPC messages from main process
function handleMainMessage(message: string) {
  try {
    const data = JSON.parse(message);

    // Handle menu commands
    if (data.method && data.method.startsWith('menu:')) {
      const handler = menuHandlers.get(data.method);
      if (handler) {
        handler();
      }
    }
  } catch {
    // Not a menu command, ignore
  }
}

// Set up message listener
if (typeof window !== 'undefined' && window.__bunlet) {
  window.__bunlet.onMessage(handleMainMessage);
}

export function useIpc() {
  const showPreview = ref(true);
  const showSidebar = ref(true);

  function onMenuCommand(command: string, handler: MenuHandler) {
    menuHandlers.set(command, handler);
  }

  function offMenuCommand(command: string) {
    menuHandlers.delete(command);
  }

  return {
    showPreview,
    showSidebar,
    onMenuCommand,
    offMenuCommand,
  };
}
