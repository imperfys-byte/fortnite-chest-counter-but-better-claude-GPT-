import { useRef, useState } from "react";
import { Links, SOURCE_URL } from "@/components/links";
import { MatchesCard } from "@/components/matches-card";
import { ProgressDialog } from "@/components/progress-dialog";
import { ReplayPicker } from "@/components/replay-picker";
import { Hero } from "@/components/hero";
import { StatTiles } from "@/components/stat-tiles";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { downloadBackup, readBackup } from "@/lib/backup";
import { formatCount } from "@/lib/format";
import { cancelParsing, parseReplay, ReplayTimeout } from "@/lib/parser";
import {
  loadMatches,
  loadTimedOut,
  mergeMatches,
  saveMatches,
  saveTimedOut,
} from "@/lib/saved-matches";
import { loadSettings, saveSettings } from "@/lib/settings";
import { summarize } from "@/lib/stats";
import type { Issue, ReplayFile } from "@/types/match.types";
import type { Settings } from "@/types/settings.types";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  // every match counted so far, including earlier visits (kept in localStorage)
  const [matches, setMatches] = useState(loadMatches);
  // token odds, chests added by hand and the teammates checkbox (kept in localStorage)
  const [settings, setSettings] = useState(loadSettings);
  // whether teammates' chests count towards the totals and the chart, remembered with the other settings
  const includeSquad = settings.includeSquad;
  // files from the last count that could not be counted
  const [issues, setIssues] = useState<Issue[]>([]);
  const [progress, setProgress] = useState(0); // files handled in the running count
  const [busy, setBusy] = useState(false);

  const updateFiles = (next: File[]) => {
    if (busy) return; // the running count indexes into the current list
    setFiles(next);
  };
  const clearSaved = () => {
    if (!confirm("Remove all saved matches from this browser?")) return;
    saveMatches([]);
    saveTimedOut([]); // so replays that timed out get another try
    setMatches([]);
    setIssues([]);
  };
  const updateSettings = (next: Settings) => {
    saveSettings(next);
    setSettings(next);
  };
  const importMatches = async (file: File) => {
    const { matches: incoming, settings: imported } = await readBackup(file);
    if (imported) updateSettings(imported);
    if (incoming.length === 0 && !imported) {
      toast.add({
        type: "warning",
        title: "No matches found in that file",
        description: "Pick a file saved with Export.",
      });
      return;
    }
    const all = mergeMatches(matches, incoming);
    const added = all.length - matches.length;
    saveMatches(all);
    setMatches(all);
    toast.add({
      type: added > 0 ? "success" : "info",
      title:
        added > 0
          ? `Imported ${formatCount(added, "match")}`
          : incoming.length > 0
            ? "Every match in that file was already saved"
            : "No matches in that file",
      description: imported ? "Settings were imported too." : undefined,
    });
  };
  const cancelled = useRef(false);
  const cancel = () => {
    cancelled.current = true;
    cancelParsing();
  };
  const countChests = async () => {
    cancelled.current = false;
    setBusy(true);
    setProgress(0);
    const all = [...matches];
    const notes: Issue[] = [];
    let handled = 0;
    let omitted = 0; // already counted: left out of the table, reported in one toast at the end
    const timedOut = loadTimedOut();
    let slow = 0; // timed out on an earlier count: not tried again, also reported in a toast
    for (const file of files) {
      const sameFile = (f: ReplayFile) =>
        f.fileName === file.name && f.fileSize === file.size;
      // same name and size as a saved match: already scanned, no need to parse it again
      const known = all.some(sameFile);
      const knownSlow = timedOut.some(sameFile);
      const result =
        known || knownSlow
          ? null
          : await parseReplay(file).catch((e) =>
              e instanceof Error ? e : new Error(String(e)),
            );
      if (cancelled.current) break;
      if (knownSlow) slow++;
      else if (result instanceof Error) {
        if (result instanceof ReplayTimeout) {
          timedOut.push({ fileName: file.name, fileSize: file.size });
          saveTimedOut(timedOut);
        }
        notes.push({
          fileName: file.name,
          message: result.message.split("\n")[0],
        });
      } else if (
        result === null ||
        (result.matchId && all.some((m) => m.matchId === result.matchId))
      )
        omitted++;
      else {
        all.push(result);
        saveMatches(all); // save as we go, so a cancel or a closed tab keeps what was counted
        setMatches([...all]);
      }
      setIssues([...notes]);
      setProgress(++handled);
    }
    setFiles(files.slice(handled)); // after a cancel, the files not reached stay in the list
    setBusy(false);
    if (omitted > 0)
      toast.add({
        type: "info",
        title:
          omitted === 1
            ? "1 replay was omitted as it was already counted"
            : `${omitted} replays were omitted as they were already counted`,
      });
    if (slow > 0)
      toast.add({
        type: "info",
        title:
          slow === 1
            ? "1 replay was skipped as it timed out before"
            : `${slow} replays were skipped as they timed out before`,
        description: "Clear saved to try again.",
      });
  };

  const summary = summarize(matches, includeSquad, settings.extraChests);

  return (
    <div className="relative min-h-svh overflow-hidden">
      {/* sky: purple glow at the top fading into deep blue, with faint diagonal light streaks */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,#6a35e0_0%,#2a1f9e_35%,transparent_70%),radial-gradient(ellipse_60%_50%_at_100%_100%,#0f4fb8_0%,transparent_60%),linear-gradient(180deg,#141a5e_0%,#0a1038_60%,#070b28_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(115deg,rgb(255_255_255/3%)_0px,rgb(255_255_255/3%)_2px,transparent_2px,transparent_28px)]"
      />

      <main className="relative mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 lg:py-14">
        <header className="flex flex-col items-start gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="game-title text-6xl drop-shadow-[0_4px_0_rgb(0_0_0/45%)] sm:text-7xl">
            <span className="text-primary">Chest</span>{" "}
            <span className="text-white">Counter</span>
          </h1>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="game-title rounded-md bg-[var(--electric)] px-3 py-1.5 text-lg text-[#0a1038] shadow-[0_4px_0_rgb(0_0_0/35%)]">
              Made by imperfy
            </span>
            <span className="text-sm text-muted-foreground">
              Count every chest you opened, straight from your replays
            </span>
          </div>
        </header>
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Hero
            summary={summary}
            failed={issues.length}
            includeSquad={includeSquad}
            onIncludeSquad={(value) =>
              updateSettings({ ...settings, includeSquad: value })
            }
            settings={settings}
            onSettings={updateSettings}
          />
          {/* first on a phone, where adding replays is the first thing to do */}
          <section className="order-first flex flex-col gap-4 lg:order-last">
            <ReplayPicker
              files={files}
              disabled={busy}
              onAdd={(added) => updateFiles([...files, ...added])}
              onRemove={(index) =>
                updateFiles(files.filter((_, i) => i !== index))
              }
            />
            <Button
              size="lg"
              className="h-14 rounded-lg font-heading text-xl tracking-wide uppercase shadow-[0_5px_0_#b8860b] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#b8860b]"
              disabled={files.length === 0 || busy}
              onClick={countChests}
            >
              Count chests
              {files.length > 0 && ` in ${formatCount(files.length, "replay")}`}
            </Button>
          </section>
        </div>

        <StatTiles summary={summary} />

        <MatchesCard
          matches={matches}
          issues={issues}
          includeSquad={includeSquad}
          busy={busy}
          onClear={clearSaved}
          onExport={() => downloadBackup(matches, settings)}
          onImport={importMatches}
        />

        {/* bottom padding keeps the last line clear of the pinned links on a narrow screen */}
        <footer className="flex flex-col gap-1 pt-2 pb-8 text-center text-xs text-muted-foreground">
          <p>
            <span className="font-heading tracking-wide text-primary uppercase">
              Made by imperfy
            </span>{" "}
            · based on{" "}
            <a
              href="https://github.com/Jose-AE/fortnite-chest-counter"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Fortnite Chest Counter by Jose-AE
            </a>{" "}
            (AGPL-3.0), with a fix so chests are not counted twice ·{" "}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              source code
            </a>
          </p>
          <p>
            A fan-made tool. Not affiliated with, endorsed or sponsored by Epic
            Games. Fortnite is a trademark of Epic Games, Inc.
          </p>
        </footer>
      </main>

      <Links />

      <ProgressDialog
        open={busy}
        files={files}
        done={progress}
        totalChests={summary.total}
        failed={issues.length}
        onCancel={cancel}
      />
    </div>
  );
}

export default App;
