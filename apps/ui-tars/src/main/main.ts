/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { electronApp, optimizer } from '@electron-toolkit/utils';
import {
  app,
  BrowserView,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  session,
  WebContentsView,
  screen,
} from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import ElectronStore from 'electron-store';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

import * as env from '@main/env';
import { logger } from '@main/logger';
import {
  LauncherWindow,
  createMainWindow,
  createSettingsWindow,
} from '@main/window/index';
import { registerIpcMain } from '@ui-tars/electron-ipc/main';
import { ipcRoutes } from './ipcRoutes';

import { UTIOService } from './services/utio';
import { store } from './store/create';
import { SettingStore } from './store/setting';
import { createTray } from './tray';
import { registerSettingsHandlers } from './services/settings';
import { sanitizeState } from './utils/sanitizeState';

const { isProd } = env;

// 在应用初始化之前启用辅助功能支持
app.commandLine.appendSwitch('force-renderer-accessibility');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
  app.quit();
}

logger.debug('[env]', env);

ElectronStore.initRenderer();

class AppUpdater {
  constructor() {
    // autoUpdater.logger = logger;
    // autoUpdater.checkForUpdatesAndNotify();
    if (!env.isE2eTest) {
      updateElectronApp({
        updateSource: {
          type: UpdateSourceType.ElectronPublicUpdateService,
          repo: 'bytedance/UI-TARS-desktop',
          host: 'https://update.electronjs.org',
        },
        updateInterval: '20 minutes',
        logger,
      });
    }
  }
}

if (isProd) {
  import('source-map-support').then(({ default: sourceMapSupport }) => {
    sourceMapSupport.install();
  });
}

const loadDevDebugTools = async () => {
  import('electron-debug').then(({ default: electronDebug }) => {
    electronDebug({ showDevTools: false });
  });

  import('electron-devtools-installer')
    .then(({ default: installExtensionDefault, REACT_DEVELOPER_TOOLS }) => {
      // @ts-ignore
      const installExtension = installExtensionDefault?.default;
      const extensions = [installExtension(REACT_DEVELOPER_TOOLS)];

      return Promise.all(extensions)
        .then((names) => logger.info('Added Extensions:', names.join(', ')))
        .catch((err) =>
          logger.error('An error occurred adding extension:', err),
        );
    })
    .catch(logger.error);
};

const initializeApp = async () => {
  const isAccessibilityEnabled = app.isAccessibilitySupportEnabled();
  logger.info('isAccessibilityEnabled', isAccessibilityEnabled);
  if (env.isMacOS) {
    app.setAccessibilitySupportEnabled(true);
    const { ensurePermissions } = await import('@main/utils/systemPermissions');

    const ensureScreenCapturePermission = ensurePermissions();
    logger.info('ensureScreenCapturePermission', ensureScreenCapturePermission);
  }

  // if (env.isDev) {
  await loadDevDebugTools();
  // }

  logger.info('createTray');
  // Tray
  await createTray();

  // Send app launched event
  await UTIOService.getInstance().appLaunched();

  const launcherWindowIns = LauncherWindow.getInstance();

  globalShortcut.register('Alt+T', () => {
    launcherWindowIns.show();
  });

  logger.info('createMainWindow');
  let mainWindow = createMainWindow();
  const settingsWindow = createSettingsWindow({ showInBackground: true });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();

  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        const primaryDisplay = screen.getPrimaryDisplay();
        const primarySource = sources.find(
          (source) => source.display_id === primaryDisplay.id.toString(),
        );

        callback({ video: primarySource!, audio: 'loopback' });
      });
    },
    { useSystemPicker: false },
  );

  logger.info('mainZustandBridge');

  const { unsubscribe } = registerIPCHandlers([
    mainWindow,
    settingsWindow,
    ...(launcherWindowIns.getWindow() ? [launcherWindowIns.getWindow()!] : []),
  ]);

  app.on('window-all-closed', () => {
    logger.info('window-all-closed');
    if (!env.isMacOS) {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    logger.info('before-quit');
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => window.destroy());
  });

  app.on('quit', async () => {
    logger.info('app quit');
    unsubscribe();

    // Deactivate all MCP servers
    const mcpClient = await createMcpClient();
    await mcpClient.cleanup();
  });

  app.on('activate', () => {
    logger.info('app activate');
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow();
    } else {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });

  logger.info('initializeApp end');

  // Check and update remote presets
  const settings = SettingStore.getStore();
  if (
    settings.presetSource?.type === 'remote' &&
    settings.presetSource.autoUpdate
  ) {
    try {
      await SettingStore.importPresetFromUrl(settings.presetSource.url!, true);
    } catch (error) {
      logger.error('Failed to update preset:', error);
    }
  }
};

/**
 * Register IPC handlers
 */
const registerIPCHandlers = (
  wrappers: (BrowserWindow | WebContentsView | BrowserView)[],
) => {
  ipcMain.handle('getState', () => {
    const state = store.getState();
    return sanitizeState(state);
  });

  // only send state to the wrappers that are not destroyed
  ipcMain.on('subscribe', (state: unknown) => {
    for (const wrapper of wrappers) {
      const webContents = wrapper?.webContents;
      if (webContents?.isDestroyed()) {
        break;
      }
      webContents?.send(
        'subscribe',
        sanitizeState(state as Record<string, unknown>),
      );
    }
  });

  const unsubscribe = store.subscribe((state: unknown) =>
    ipcMain.emit('subscribe', state),
  );

  // TODO: move to ipc routes
  ipcMain.handle('utio:shareReport', async (_, params) => {
    await UTIOService.getInstance().shareReport(params);
  });

  registerSettingsHandlers();
  // register ipc services routes
  registerIpcMain(ipcRoutes);

  return { unsubscribe };
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    electronApp.setAppUserModelId('com.electron');

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    await initializeApp();

    logger.info('app.whenReady end');
  })
  .catch(console.log);
