import { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap,
  Gauge,
  FileDown,
  History,
  Save,
  Trash2,
  X,
  FolderPlus,
  Pencil,
  Check,
  ArrowLeft,
} from "lucide-react";

const FOLDERS_KEY = "meter-split-calculator:folders";
// Legacy single-calculation keys, kept only for one-time migration
const LEGACY_STORAGE_KEY = "meter-split-calculator:inputs";
const LEGACY_HISTORY_KEY = "meter-split-calculator:history";

function defaultInputs() {
  return {
    energyCost: "961.90",
    totalPaid: "1015.00",
    creditBefore: "5.97",
    creditAfter: "125.65",
    mainPrev: "24166.43",
    mainCurr: "24328.66",
    subPrev: "4443.87",
    subCurr: "4559.28",
  };
}

function makeId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadFolders() {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to migration / defaults
  }

  // One-time migration from the old single-calculation storage, if present
  let inputs = defaultInputs();
  let history = [];
  try {
    const rawInputs = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawInputs) inputs = { ...inputs, ...JSON.parse(rawInputs) };
  } catch {
    // ignore
  }
  try {
    const rawHistory = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (rawHistory) {
      const parsedHistory = JSON.parse(rawHistory);
      if (Array.isArray(parsedHistory)) history = parsedHistory;
    }
  } catch {
    // ignore
  }

  return [{ id: makeId(), name: "My Meter", inputs, history, mainName: "Main Meter", subName: "Sub Meter" }];
}

const field =
  "w-full bg-[#0F1311] border border-[#2A322C] rounded-md px-3 py-2 text-[#D8F5CE] font-mono text-lg tracking-wide focus:outline-none focus:border-[#6FE04A] focus:ring-1 focus:ring-[#6FE04A] transition-colors";

const label = "text-xs uppercase tracking-[0.14em] text-[#7C8A7A] mb-1 block";

function NumInput({ value, onChange, placeholder }) {
  return (
    <input
      className={field}
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function n(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
}

export default function MeterSplitCalculator() {
  const [folders, setFolders] = useState(loadFolders);
  const [activeId, setActiveId] = useState(() => folders[0]?.id);
  const [view, setView] = useState("home"); // "home" | "calculator"
  const [showHistory, setShowHistory] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // { folder, index }
  const undoTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const active =
    folders.find((f) => f.id === activeId) ||
    folders[0] || { id: null, name: "", inputs: defaultInputs(), history: [] };
  const inputs = active.inputs;
  const history = active.history || [];
  const mainName = active.mainName || "Main Meter";
  const subName = active.subName || "Sub Meter";

  const updateInput = (key, value) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === active.id ? { ...f, inputs: { ...f.inputs, [key]: value } } : f
      )
    );
  };

  const updateMeterName = (key, value) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === active.id ? { ...f, [key]: value } : f))
    );
  };

  const { energyCost, totalPaid, creditBefore, creditAfter, mainPrev, mainCurr, subPrev, subCurr } =
    inputs;

  const r = useMemo(() => {
    const cost = n(energyCost);
    const paid = n(totalPaid);
    const before = n(creditBefore);
    const after = n(creditAfter);

    const adjustedCost = cost - before + after;

    const mainUsage = n(mainCurr) - n(mainPrev);
    const subUsage = n(subCurr) - n(subPrev);

    const unitPrice = mainUsage !== 0 ? adjustedCost / mainUsage : 0;

    const subCostRaw = unitPrice * subUsage;

    const demandCharge = paid - cost;
    const halfCharge = demandCharge / 2;

    const mainOnlyUsage = mainUsage - subUsage;
    const mainCostRaw = unitPrice * mainOnlyUsage;

    const subTotal = subCostRaw + halfCharge;
    const mainTotal = mainCostRaw + halfCharge;

    return {
      adjustedCost,
      mainUsage,
      subUsage,
      unitPrice,
      subCostRaw,
      demandCharge,
      halfCharge,
      mainOnlyUsage,
      mainCostRaw,
      subTotal,
      mainTotal,
    };
  }, [energyCost, totalPaid, creditBefore, creditAfter, mainPrev, mainCurr, subPrev, subCurr]);

  const fmt = (x) =>
    x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleDownload = () => {
    const prevTitle = document.title;
    const safeName = (active.name || "Meter Split").replace(/[\\/:*?"<>|]/g, "-");
    document.title = safeName;

    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    window.addEventListener("afterprint", restoreTitle);

    window.print();
  };

  const handleSaveToHistory = () => {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      ...inputs,
      mainTotal: r.mainTotal,
      subTotal: r.subTotal,
    };
    setFolders((prev) =>
      prev.map((f) =>
        f.id === active.id ? { ...f, history: [entry, ...(f.history || [])].slice(0, 50) } : f
      )
    );
  };

  const handleDeleteEntry = (id) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === active.id ? { ...f, history: (f.history || []).filter((h) => h.id !== id) } : f
      )
    );
  };

  const handleLoadEntry = (entry) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === active.id
          ? {
              ...f,
              inputs: {
                energyCost: entry.energyCost,
                totalPaid: entry.totalPaid,
                creditBefore: entry.creditBefore,
                creditAfter: entry.creditAfter,
                mainPrev: entry.mainPrev,
                mainCurr: entry.mainCurr,
                subPrev: entry.subPrev,
                subCurr: entry.subCurr,
              },
            }
          : f
      )
    );
    setShowHistory(false);
  };

  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const newFolder = {
      id: makeId(),
      name,
      inputs: defaultInputs(),
      history: [],
      mainName: "Main Meter",
      subName: "Sub Meter",
    };
    setFolders((prev) => [...prev, newFolder]);
    setActiveId(newFolder.id);
    setNewFolderName("");
    setView("calculator");
  };

  const handleStartRename = (folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const handleConfirmRename = () => {
    const name = renameValue.trim();
    if (name) {
      setFolders((prev) => prev.map((f) => (f.id === renamingId ? { ...f, name } : f)));
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDeleteFolder = (id) => {
    const index = folders.findIndex((f) => f.id === id);
    if (index === -1) return;
    const folder = folders[index];
    const next = folders.filter((f) => f.id !== id);
    setFolders(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null);
      if (view === "calculator") setView("home");
    }

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingDelete({ folder, index });
    undoTimerRef.current = setTimeout(() => {
      setPendingDelete(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!pendingDelete) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setFolders((prev) => {
      const next = [...prev];
      next.splice(Math.min(pendingDelete.index, next.length), 0, pendingDelete.folder);
      return next;
    });
    setActiveId(pendingDelete.folder.id);
    setPendingDelete(null);
  };

  const openFolder = (id) => {
    setActiveId(id);
    setView("calculator");
  };

  return (
    <div className="min-h-screen bg-[#0A0D0B] text-[#D8F5CE] p-5 sm:p-10 font-sans">
      <style>{`
        #meter-receipt { display: none; }
        @media print {
          body * { visibility: hidden; }
          #meter-receipt, #meter-receipt * { visibility: visible; }
          #meter-receipt {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          @page { size: auto; margin: 14mm; }
        }
      `}</style>

      {/* HOME VIEW — folder grid */}
      {view === "home" && (
        <div className="max-w-3xl mx-auto no-print">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={20} className="text-[#6FE04A]" />
            <h1 className="text-2xl font-semibold tracking-tight text-[#EAF7E4]">
              Meter Split Calculator
            </h1>
          </div>
          <p className="text-sm text-[#7C8A7A] mb-6">
            Tap a folder to open its calculator, or create a new one for someone else.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {folders.map((f) => {
              const isRenaming = renamingId === f.id;
              return (
                <div
                  key={f.id}
                  className="relative flex flex-col items-center rounded-2xl border border-[#212B1D] bg-[#0D110C] p-6 hover:border-[#3A463A] transition-colors"
                >
                  {!isRenaming && (
                    <button
                      onClick={() => handleDeleteFolder(f.id)}
                      className="absolute top-2 right-2 bg-[#1A1F17] border border-[#2A322C] rounded-full p-1.5 text-[#7C8A7A] hover:text-[#E0524A] hover:border-[#E0524A] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => !isRenaming && openFolder(f.id)}
                    className="flex flex-col items-center gap-2 w-full"
                  >
                    <div className="relative w-24 h-[72px]">
                      <div className="absolute left-0 top-0 w-10 h-5 rounded-t-[5px] bg-[#4C5B47]" />
                      <div className="absolute left-0 top-3 w-24 h-[60px] rounded-lg rounded-tl-none border-2 bg-[#3A4636] border-[#4C5B47]" />
                    </div>
                    <span className="text-base font-medium text-[#D8F5CE] text-center leading-tight break-words w-full px-1 mt-1">
                      {f.name}
                    </span>
                    <span className="text-xs text-[#5C6B59]">
                      {(f.history || []).length} saved
                    </span>
                  </button>

                  {isRenaming ? (
                    <div className="flex items-center gap-1.5 w-full mt-3">
                      <input
                        autoFocus
                        className="w-full bg-[#0F1311] border border-[#2A322C] rounded-md px-2 py-1.5 text-[#D8F5CE] text-sm focus:outline-none focus:border-[#6FE04A]"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmRename()}
                      />
                      <button
                        onClick={handleConfirmRename}
                        className="text-[#6FE04A] hover:text-[#8FFF6E] transition-colors shrink-0"
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartRename(f)}
                      className="flex items-center gap-1.5 text-xs text-[#7C8A7A] hover:text-[#D8F5CE] transition-colors mt-2"
                    >
                      <Pencil size={12} />
                      Rename
                    </button>
                  )}
                </div>
              );
            })}

            {/* Create new folder box */}
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2A322C] p-6 gap-2">
              <button
                onClick={handleAddFolder}
                disabled={!newFolderName.trim()}
                className="w-24 h-[72px] flex items-center justify-center rounded-lg border-2 border-dashed border-[#4C5B47] text-[#5C6B59] hover:border-[#6FE04A] hover:text-[#6FE04A] transition-colors disabled:opacity-50 disabled:hover:border-[#4C5B47] disabled:hover:text-[#5C6B59]"
              >
                <FolderPlus size={30} />
              </button>
              <input
                className="w-full bg-[#0F1311] border border-[#2A322C] rounded-md px-2 py-1.5 text-[#D8F5CE] text-sm text-center focus:outline-none focus:border-[#6FE04A] mt-1"
                placeholder="New folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
              />
            </div>
          </div>

          {folders.length === 0 && (
            <p className="text-sm text-[#5C6B59] mt-6 text-center">
              No folders yet — create one above to start a calculation.
            </p>
          )}
        </div>
      )}

      {/* CALCULATOR VIEW */}
      {view === "calculator" && active.id && (
      <div className="max-w-3xl mx-auto no-print">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("home")}
              className="text-[#7C8A7A] hover:text-[#8FFF6E] transition-colors p-1 -ml-1"
            >
              <ArrowLeft size={20} />
            </button>
            <Gauge size={20} className="text-[#6FE04A]" />
            <h1 className="text-2xl font-semibold tracking-tight text-[#EAF7E4]">
              {active.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 bg-[#12160F] border border-[#2A322C] text-[#D8F5CE] font-medium text-sm px-3 py-2 rounded-md hover:border-[#6FE04A] transition-colors"
            >
              <History size={16} />
              History
            </button>
            <button
              onClick={handleSaveToHistory}
              className="flex items-center gap-2 bg-[#12160F] border border-[#2A322C] text-[#D8F5CE] font-medium text-sm px-3 py-2 rounded-md hover:border-[#6FE04A] transition-colors"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-[#6FE04A] text-[#0A0D0B] font-medium text-sm px-4 py-2 rounded-md hover:bg-[#8FFF6E] transition-colors"
            >
              <FileDown size={16} />
              Download PDF
            </button>
          </div>
        </div>

        <p className="text-sm text-[#7C8A7A] mb-6 mt-2">
          {mainName} fronts the recharge. {subName}'s usage is priced at the {mainName.toLowerCase()}'s
          rate; {mainName.toLowerCase()}'s own usage is the remainder. Both split the demand charge evenly.
        </p>

        {/* Meter names card */}
        <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5 mb-5">
          <h2 className="text-sm font-medium text-[#EAF7E4] uppercase tracking-wide mb-4">
            Meter names
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={label}>Main meter name</span>
              <input
                className={field.replace("font-mono text-lg", "text-base")}
                value={active.mainName || ""}
                placeholder="Main Meter"
                onChange={(e) => updateMeterName("mainName", e.target.value)}
              />
            </div>
            <div>
              <span className={label}>Sub meter name</span>
              <input
                className={field.replace("font-mono text-lg", "text-base")}
                value={active.subName || ""}
                placeholder="Sub Meter"
                onChange={(e) => updateMeterName("subName", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Receipt card */}
        <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-[#6FE04A]" />
            <h2 className="text-sm font-medium text-[#EAF7E4] uppercase tracking-wide">
              Recharge Receipt
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={label}>Energy Cost (Tk)</span>
              <NumInput value={energyCost} onChange={(v) => updateInput("energyCost", v)} placeholder="961.90" />
            </div>
            <div>
              <span className={label}>Total Paid incl. fees (Tk)</span>
              <NumInput value={totalPaid} onChange={(v) => updateInput("totalPaid", v)} placeholder="1015.00" />
            </div>
            <div>
              <span className={label}>Credit before (subtract)</span>
              <NumInput value={creditBefore} onChange={(v) => updateInput("creditBefore", v)} placeholder="5.97" />
            </div>
            <div>
              <span className={label}>Emergency balance used (add)</span>
              <NumInput value={creditAfter} onChange={(v) => updateInput("creditAfter", v)} placeholder="125.65" />
            </div>
          </div>
        </div>

        {/* Meter cards */}
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5">
            <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide mb-4 border-b border-[#212B1D] pb-2">
              {mainName}
            </h3>
            <span className={label}>Previous reading (kWh)</span>
            <NumInput value={mainPrev} onChange={(v) => updateInput("mainPrev", v)} placeholder="0.00" />
            <div className="h-3" />
            <span className={label}>Current reading (kWh)</span>
            <NumInput value={mainCurr} onChange={(v) => updateInput("mainCurr", v)} placeholder="0.00" />
            <div className="mt-4 pt-4 border-t border-[#212B1D] flex justify-between items-baseline">
              <span className="text-xs text-[#7C8A7A]">Full reading diff</span>
              <span className="font-mono text-[#6FE04A]">{fmt(r.mainUsage)} kWh</span>
            </div>
            <p className="text-[11px] text-[#5C6B59] mt-1">
              Sets the unit price. Includes {subName.toLowerCase()}'s draw.
            </p>
          </div>

          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5">
            <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide mb-4 border-b border-[#212B1D] pb-2">
              {subName}
            </h3>
            <span className={label}>Previous reading (kWh)</span>
            <NumInput value={subPrev} onChange={(v) => updateInput("subPrev", v)} placeholder="0.00" />
            <div className="h-3" />
            <span className={label}>Current reading (kWh)</span>
            <NumInput value={subCurr} onChange={(v) => updateInput("subCurr", v)} placeholder="0.00" />
            <div className="mt-4 pt-4 border-t border-[#212B1D] flex justify-between items-baseline">
              <span className="text-xs text-[#7C8A7A]">Usage</span>
              <span className="font-mono text-[#6FE04A]">{fmt(r.subUsage)} kWh</span>
            </div>
            <p className="text-[11px] text-[#5C6B59] mt-1">
              Priced at {r.unitPrice ? r.unitPrice.toFixed(4) : "0.0000"} Tk/kWh
            </p>
          </div>
        </div>

        {/* LCD-style result panel */}
        <div className="bg-[#0D1210] border border-[#2A3C25] rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-medium text-[#7C8A7A] uppercase tracking-wide mb-4">
            Split result
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-[#0A0D0B] border border-[#1B241A] rounded-lg p-4">
              <div className="text-xs text-[#7C8A7A] mb-1">{mainName} total</div>
              <div className="font-mono text-3xl text-[#8FFF6E] tabular-nums">
                {fmt(r.mainTotal)} <span className="text-base text-[#6FE04A]">Tk</span>
              </div>
            </div>
            <div className="bg-[#0A0D0B] border border-[#1B241A] rounded-lg p-4">
              <div className="text-xs text-[#7C8A7A] mb-1">{subName} total</div>
              <div className="font-mono text-3xl text-[#8FFF6E] tabular-nums">
                {fmt(r.subTotal)} <span className="text-base text-[#6FE04A]">Tk</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-sm font-mono text-[#93A38F]">
            <div className="flex justify-between">
              <span>Adjusted energy cost</span>
              <span className="text-[#D8F5CE]">{fmt(r.adjustedCost)} Tk</span>
            </div>
            <div className="flex justify-between">
              <span>Unit price</span>
              <span className="text-[#D8F5CE]">{r.unitPrice.toFixed(6)} Tk/kWh</span>
            </div>
            <div className="flex justify-between">
              <span>{subName} usage cost</span>
              <span className="text-[#D8F5CE]">{fmt(r.subCostRaw)} Tk</span>
            </div>
            <div className="flex justify-between">
              <span>{mainName}-only usage (main − sub)</span>
              <span className="text-[#D8F5CE]">{fmt(r.mainOnlyUsage)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>{mainName} usage cost</span>
              <span className="text-[#D8F5CE]">{fmt(r.mainCostRaw)} Tk</span>
            </div>
            <div className="flex justify-between">
              <span>Demand charge (paid − energy cost)</span>
              <span className="text-[#D8F5CE]">{fmt(r.demandCharge)} Tk</span>
            </div>
            <div className="flex justify-between">
              <span>Half demand charge, each meter</span>
              <span className="text-[#D8F5CE]">{fmt(r.halfCharge)} Tk</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Printable receipt — hidden on screen, shown only when printing */}
      <div
        id="meter-receipt"
        className="bg-white text-black font-mono text-[13px] leading-snug p-4"
      >
        <div className="text-center font-bold text-[20px] mb-1">METER SPLIT RECEIPT</div>
        <div className="text-center text-[15px] font-bold mb-1">{active.name}</div>
        <div className="text-center text-[11px] italic mb-0.5">
          main usage = main reading minus sub usage
        </div>
        <div className="text-center text-[11px] mb-3">
          {new Date().toLocaleString()}
        </div>
        <div className="border-t-2 border-black my-2" />

        {/* Totals up top, large and clear */}
        <div className="flex justify-between gap-4 mb-3">
          <div className="flex-1 border-2 border-black rounded-md p-2 text-center">
            <div className="text-[11px] uppercase tracking-wide">{mainName} Total</div>
            <div className="text-[22px] font-bold">{fmt(r.mainTotal)} Tk</div>
          </div>
          <div className="flex-1 border-2 border-black rounded-md p-2 text-center">
            <div className="text-[11px] uppercase tracking-wide">{subName} Total</div>
            <div className="text-[22px] font-bold">{fmt(r.subTotal)} Tk</div>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-2" />
        <div className="font-bold text-[13px] mb-1.5">Calculation steps</div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 1 — Adjusted energy cost</div>
          <div>{fmt(n(energyCost))} − {fmt(n(creditBefore))} + {fmt(n(creditAfter))} = <b>{fmt(r.adjustedCost)} Tk</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 2 — {mainName} reading diff</div>
          <div>{fmt(n(mainCurr))} − {fmt(n(mainPrev))} = <b>{fmt(r.mainUsage)} kWh</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 3 — Unit price</div>
          <div>{fmt(r.adjustedCost)} / {fmt(r.mainUsage)} = <b>{r.unitPrice.toFixed(6)} Tk/kWh</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 4 — {subName} reading diff</div>
          <div>{fmt(n(subCurr))} − {fmt(n(subPrev))} = <b>{fmt(r.subUsage)} kWh</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 5 — {subName} cost</div>
          <div>{fmt(r.subUsage)} × {r.unitPrice.toFixed(6)} = {fmt(r.subCostRaw)} Tk</div>
          <div className="text-[11px] italic">+ half of demand charge: ({fmt(n(totalPaid))} − {fmt(n(energyCost))}) / 2 = {fmt(r.halfCharge)}</div>
          <div>{fmt(r.subCostRaw)} + {fmt(r.halfCharge)} = <b>{fmt(r.subTotal)} Tk</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 6 — {mainName}-only usage</div>
          <div className="text-[11px] italic">({mainName.toLowerCase()} reading includes {subName.toLowerCase()}'s draw)</div>
          <div>{fmt(r.mainUsage)} − {fmt(r.subUsage)} = <b>{fmt(r.mainOnlyUsage)} kWh</b></div>
        </div>

        <div className="mb-1.5">
          <div className="font-bold">STEP 7 — {mainName} cost</div>
          <div>{fmt(r.mainOnlyUsage)} × {r.unitPrice.toFixed(6)} = {fmt(r.mainCostRaw)} Tk</div>
          <div>{fmt(r.mainCostRaw)} + {fmt(r.halfCharge)} = <b>{fmt(r.mainTotal)} Tk</b></div>
        </div>

        <div className="border-t-2 border-black my-2" />
        <div className="text-center italic text-[11px]">Thank you</div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-4 no-print">
          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#212B1D]">
              <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide">
                Saved calculations — {active.name}
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-[#7C8A7A] hover:text-[#D8F5CE] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {history.length === 0 && (
                <p className="text-sm text-[#7C8A7A] text-center py-8">
                  No saved calculations yet for this folder. Tap "Save" on the main screen to
                  keep a record.
                </p>
              )}
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-[#0A0D0B] border border-[#1B241A] rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <button
                    onClick={() => handleLoadEntry(entry)}
                    className="text-left flex-1"
                  >
                    <div className="text-xs text-[#7C8A7A]">
                      {new Date(entry.date).toLocaleString()}
                    </div>
                    <div className="font-mono text-sm text-[#D8F5CE] mt-1">
                      Main {fmt(entry.mainTotal)} Tk · Sub {fmt(entry.subTotal)} Tk
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="text-[#7C8A7A] hover:text-[#E0524A] transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Undo-delete snackbar */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] no-print px-4 w-full max-w-sm">
          <div className="flex items-center justify-between gap-3 bg-[#1E241A] border border-[#2A322C] rounded-full pl-4 pr-2 py-2 shadow-lg">
            <span className="text-sm text-[#D8F5CE] truncate">
              Deleted "{pendingDelete.folder.name}"
            </span>
            <button
              onClick={handleUndoDelete}
              className="text-sm font-semibold text-[#8FFF6E] px-3 py-1.5 rounded-full hover:bg-[#2A3620] transition-colors shrink-0"
            >
              UNDO
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
