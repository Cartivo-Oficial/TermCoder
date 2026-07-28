import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconRefresh,
  IconUpload,
  IconDownload,
  IconX,
} from "./Icons";

export interface SyncSettings {
  enabled: boolean;
  autoSync: boolean;
  lastSync: number;
  syncInterval: number; // in minutes
  settingsToSync: string[];
}

interface SettingsSyncProps {
  settings: SyncSettings;
  onToggleSync: (enabled: boolean) => void;
  onToggleAutoSync: (enabled: boolean) => void;
  onSyncNow: () => Promise<void>;
  onSetSyncInterval: (interval: number) => void;
  onToggleSettingSync: (setting: string) => void;
  isSyncing: boolean;
  syncError?: string;
}

export function SettingsSync({
  settings,
  onToggleSync,
  onToggleAutoSync,
  onSyncNow,
  onSetSyncInterval,
  onToggleSettingSync,
  isSyncing,
  syncError,
}: SettingsSyncProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const availableSettings = [
    { id: "theme", name: "Theme" },
    { id: "keybindings", name: "Keybindings" },
    { id: "snippets", name: "Snippets" },
    { id: "extensions", name: "Extensions" },
    { id: "workspace", name: "Workspace Layout" },
    { id: "editor", name: "Editor Settings" },
  ];

  const handleSyncNow = async () => {
    await onSyncNow();
  };

  return (
    <div className="settings-sync">
      <div className="settings-sync-header" onClick={() => setExpanded(!expanded)}>
        <div className="settings-sync-title">
          <span className="settings-sync-icon">☁️</span>
          <span>Settings Sync</span>
          {settings.enabled && settings.autoSync && (
            <span className="settings-sync-badge">Auto</span>
          )}
        </div>
        <div className="settings-sync-actions">
          {settings.enabled && (
            <button
              className="settings-sync-btn"
              title="Sync Now"
              onClick={(e) => {
                e.stopPropagation();
                handleSyncNow();
              }}
              disabled={isSyncing}
            >
              <IconRefresh />
            </button>
          )}
          <span className="settings-sync-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="settings-sync-body">
          <div className="settings-sync-status">
            <div className="settings-sync-toggle">
              <label className="settings-sync-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => onToggleSync(e.target.checked)}
                />
                <span>Enable Settings Sync</span>
              </label>
            </div>

            {settings.enabled && (
              <>
                <div className="settings-sync-toggle">
                  <label className="settings-sync-label">
                    <input
                      type="checkbox"
                      checked={settings.autoSync}
                      onChange={(e) => onToggleAutoSync(e.target.checked)}
                    />
                    <span>Auto Sync</span>
                  </label>
                </div>

                <div className="settings-sync-interval">
                  <label>Sync Interval:</label>
                  <select
                    value={settings.syncInterval}
                    onChange={(e) => onSetSyncInterval(Number(e.target.value))}
                    className="settings-sync-select"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>

                <div className="settings-sync-last">
                  <span>Last synced:</span>
                  <span>
                    {settings.lastSync
                      ? new Date(settings.lastSync).toLocaleString()
                      : "Never"}
                  </span>
                </div>

                {syncError && (
                  <div className="settings-sync-error">
                    <IconX />
                    <span>{syncError}</span>
                  </div>
                )}

                <button
                  className="settings-sync-btn primary full"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </button>

                <button
                  className="settings-sync-btn full"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  {showSettings ? "Hide Settings" : "Manage Settings"}
                </button>

                {showSettings && (
                  <div className="settings-sync-settings-list">
                    {availableSettings.map((setting) => (
                      <div key={setting.id} className="settings-sync-setting">
                        <label className="settings-sync-label">
                          <input
                            type="checkbox"
                            checked={settings.settingsToSync.includes(setting.id)}
                            onChange={() => onToggleSettingSync(setting.id)}
                          />
                          <span>{setting.name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {!settings.enabled && (
            <div className="settings-sync-info">
              <p>Enable settings sync to backup and sync your IDE settings across devices.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage settings sync state
export function useSettingsSync() {
  const [settings, setSettings] = useState<SyncSettings>({
    enabled: false,
    autoSync: true,
    lastSync: 0,
    syncInterval: 30,
    settingsToSync: ["theme", "keybindings", "snippets", "extensions"],
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  const toggleSync = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
  };

  const toggleAutoSync = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, autoSync: enabled }));
  };

  const setSyncInterval = (interval: number) => {
    setSettings((prev) => ({ ...prev, syncInterval: interval }));
  };

  const toggleSettingSync = (settingId: string) => {
    setSettings((prev) => {
      const settingsToSync = prev.settingsToSync.includes(settingId)
        ? prev.settingsToSync.filter((s) => s !== settingId)
        : [...prev.settingsToSync, settingId];
      return { ...prev, settingsToSync };
    });
  };

  const syncNow = async () => {
    setIsSyncing(true);
    setSyncError(undefined);

    try {
      // In real implementation, this would sync with a cloud service
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      setSettings((prev) => ({
        ...prev,
        lastSync: Date.now(),
      }));
    } catch (error) {
      setSyncError("Sync failed. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync interval
  useEffect(() => {
    if (!settings.enabled || !settings.autoSync) return;

    const interval = setInterval(() => {
      syncNow();
    }, settings.syncInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [settings.enabled, settings.autoSync, settings.syncInterval]);

  return {
    settings,
    isSyncing,
    syncError,
    toggleSync,
    toggleAutoSync,
    setSyncInterval,
    toggleSettingSync,
    syncNow,
  };
}
