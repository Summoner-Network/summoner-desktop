import React, { useEffect, useState } from "react";

export default function HelpPage(props: { onWorkspaceChange: () => void | Promise<void> }) {
  const { onWorkspaceChange } = props;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultRoot, setDefaultRoot] = useState("");
  const [displayDefaultRoot, setDisplayDefaultRoot] = useState("");
  const [savedRoot, setSavedRoot] = useState<string | null>(null);
  const [displayEffectiveRoot, setDisplayEffectiveRoot] = useState("");
  const [displayEffectiveBase, setDisplayEffectiveBase] = useState("");
  const [draftRoot, setDraftRoot] = useState("");
  const [platform, setPlatform] = useState<string>("unknown");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await window.api.settings.get();
        if (!active) return;
        if (!res.ok) {
          setError(res.error);
          setLoading(false);
          return;
        }
        setDefaultRoot(res.defaultSummonerBase);
        setDisplayDefaultRoot(res.displayDefaultSummonerBase);
        setSavedRoot(res.summonerBase);
        setDisplayEffectiveRoot(res.displayEffectiveSummonerRoot);
        setDisplayEffectiveBase(res.displayEffectiveSummonerBase);
        setDraftRoot(res.displayEffectiveSummonerBase);
        setPlatform(res.platform ?? "unknown");
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load settings");
        setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(nextValue: string | null) {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await window.api.settings.set({ summonerBase: nextValue });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setDefaultRoot(res.defaultSummonerBase);
    setDisplayDefaultRoot(res.displayDefaultSummonerBase);
    setSavedRoot(res.summonerBase);
    setDisplayEffectiveRoot(res.displayEffectiveSummonerRoot);
    setDisplayEffectiveBase(res.displayEffectiveSummonerBase);
    setDraftRoot(res.displayEffectiveSummonerBase);
    setPlatform(res.platform ?? "unknown");
    setStatus("Workspace updated. Refreshing data...");
    setSaving(false);
    await onWorkspaceChange();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Help & Settings</div>
          <div className="subtitle">Support, shortcuts, and app configuration.</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Summoner Workspace</div>
        <div className="small">Choose where Summoner stores projects, maps, logs, and configuration.</div>

        <div className="settings-edit">
          <label className="context-label" htmlFor="summoner-root-input">Workspace location</label>
          <input
            id="summoner-root-input"
            value={draftRoot}
            onChange={(event) => setDraftRoot(event.target.value)}
            placeholder={displayDefaultRoot || defaultRoot || "Use system default"}
            disabled={saving}
          />
          <div className="small">
            {platform === "win32"
              ? "Use an absolute path. Examples: C:\\SummonerData or D:\\SummonerData."
              : "Use an absolute path. Examples: /Users/you or ~/.local."}
          </div>
          <div className="small">Default: {displayDefaultRoot || defaultRoot || "—"}</div>
          <div className="small">
            {platform === "win32"
              ? `Summoner will save data in a \"summoner\" folder inside ${displayEffectiveBase || "the selected location"}.`
              : `Summoner will save data in a \"summoner\" folder inside ${displayEffectiveBase || "the selected location"}.`}
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => handleSave(draftRoot.trim() ? draftRoot.trim() : null)}
            disabled={saving || loading || draftRoot.trim() === ""}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(null)}
            disabled={saving}
          >
            Reset to Default
          </button>
          <div className="small">
            Saved override: {savedRoot ?? "None (using default)"}
          </div>
          <div className="small">In use: {displayEffectiveRoot || "—"}</div>
        </div>

        {status ? <div className="small mt6">{status}</div> : null}
        {error ? <div className="small text-error mt6">{error}</div> : null}
      </div>
    </div>
  );
}
