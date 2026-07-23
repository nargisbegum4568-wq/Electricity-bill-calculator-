import { useEffect, useMemo, useState } from "react";
import { Zap, Gauge, FileDown, History, Save, Trash2, X } from "lucide-react";

const STORAGE_KEY = "meter-split-calculator:inputs";
const HISTORY_KEY = "meter-split-calculator:history";

function loadInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
  const saved = loadInputs();

  const [energyCost, setEnergyCost] = useState(saved?.energyCost ?? "961.90");
  const [totalPaid, setTotalPaid] = useState(saved?.totalPaid ?? "1015.00");
  const [creditBefore, setCreditBefore] = useState(saved?.creditBefore ?? "5.97");
  const [creditAfter, setCreditAfter] = useState(saved?.creditAfter ?? "125.65");

  const [mainPrev, setMainPrev] = useState(saved?.mainPrev ?? "24166.43");
  const [mainCurr, setMainCurr] = useState(saved?.mainCurr ?? "24328.66");

  const [subPrev, setSubPrev] = useState(saved?.subPrev ?? "4443.87");
  const [subCurr, setSubCurr] = useState(saved?.subCurr ?? "4559.28");

  const [history, setHistory] = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        energyCost,
        totalPaid,
        creditBefore,
        creditAfter,
        mainPrev,
        mainCurr,
        subPrev,
        subCurr,
      })
    );
  }, [energyCost, totalPaid, creditBefore, creditAfter, mainPrev, mainCurr, subPrev, subCurr]);

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
    window.print();
  };

  const handleSaveToHistory = () => {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      energyCost,
      totalPaid,
      creditBefore,
      creditAfter,
      mainPrev,
      mainCurr,
      subPrev,
      subCurr,
      mainTotal: r.mainTotal,
      subTotal: r.subTotal,
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const handleDeleteEntry = (id) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const handleLoadEntry = (entry) => {
    setEnergyCost(entry.energyCost);
    setTotalPaid(entry.totalPaid);
    setCreditBefore(entry.creditBefore);
    setCreditAfter(entry.creditAfter);
    setMainPrev(entry.mainPrev);
    setMainCurr(entry.mainCurr);
    setSubPrev(entry.subPrev);
    setSubCurr(entry.subCurr);
    setShowHistory(false);
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
            width: 80mm;
          }
          @page { size: 80mm auto; margin: 6mm; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto no-print">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Gauge size={20} className="text-[#6FE04A]" />
            <h1 className="text-2xl font-semibold tracking-tight text-[#EAF7E4]">
              Meter Split Calculator
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
        <p className="text-sm text-[#7C8A7A] mb-8">
          Main meter fronts the recharge. Sub meter's usage is priced at the main meter's
          rate; main's own usage is the remainder. Both split the demand charge evenly.
        </p>

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
              <NumInput value={energyCost} onChange={setEnergyCost} placeholder="961.90" />
            </div>
            <div>
              <span className={label}>Total Paid incl. fees (Tk)</span>
              <NumInput value={totalPaid} onChange={setTotalPaid} placeholder="1015.00" />
            </div>
            <div>
              <span className={label}>Credit before (subtract)</span>
              <NumInput value={creditBefore} onChange={setCreditBefore} placeholder="5.97" />
            </div>
            <div>
              <span className={label}>Emergency balance used (add)</span>
              <NumInput value={creditAfter} onChange={setCreditAfter} placeholder="125.65" />
            </div>
          </div>
        </div>

        {/* Meter cards */}
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5">
            <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide mb-4 border-b border-[#212B1D] pb-2">
              Main Meter
            </h3>
            <span className={label}>Previous reading (kWh)</span>
            <NumInput value={mainPrev} onChange={setMainPrev} placeholder="0.00" />
            <div className="h-3" />
            <span className={label}>Current reading (kWh)</span>
            <NumInput value={mainCurr} onChange={setMainCurr} placeholder="0.00" />
            <div className="mt-4 pt-4 border-t border-[#212B1D] flex justify-between items-baseline">
              <span className="text-xs text-[#7C8A7A]">Full reading diff</span>
              <span className="font-mono text-[#6FE04A]">{fmt(r.mainUsage)} kWh</span>
            </div>
            <p className="text-[11px] text-[#5C6B59] mt-1">
              Sets the unit price. Includes sub meter's draw.
            </p>
          </div>

          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl p-5">
            <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide mb-4 border-b border-[#212B1D] pb-2">
              Sub Meter
            </h3>
            <span className={label}>Previous reading (kWh)</span>
            <NumInput value={subPrev} onChange={setSubPrev} placeholder="0.00" />
            <div className="h-3" />
            <span className={label}>Current reading (kWh)</span>
            <NumInput value={subCurr} onChange={setSubCurr} placeholder="0.00" />
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
              <div className="text-xs text-[#7C8A7A] mb-1">Main Meter total</div>
              <div className="font-mono text-3xl text-[#8FFF6E] tabular-nums">
                {fmt(r.mainTotal)} <span className="text-base text-[#6FE04A]">Tk</span>
              </div>
            </div>
            <div className="bg-[#0A0D0B] border border-[#1B241A] rounded-lg p-4">
              <div className="text-xs text-[#7C8A7A] mb-1">Sub Meter total</div>
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
              <span>Sub meter usage cost</span>
              <span className="text-[#D8F5CE]">{fmt(r.subCostRaw)} Tk</span>
            </div>
            <div className="flex justify-between">
              <span>Main-only usage (main − sub)</span>
              <span className="text-[#D8F5CE]">{fmt(r.mainOnlyUsage)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span>Main meter usage cost</span>
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

      {/* Printable receipt — hidden on screen, shown only when printing */}
      <div
        id="meter-receipt"
        className="bg-white text-black font-mono text-[9px] leading-tight p-2"
      >
        <div className="text-center font-bold text-[13px] mb-0.5">METER SPLIT RECEIPT</div>
        <div className="text-center text-[8px] italic mb-0.5">
          main usage = main reading minus sub usage
        </div>
        <div className="text-center text-[8px] mb-2">
          {new Date().toLocaleString()}
        </div>
        <div className="border-t border-dashed border-black my-1" />

        <div className="font-bold mb-0.5">STEP 1 - Adjusted energy cost</div>
        <div>{fmt(n(energyCost))} - {fmt(n(creditBefore))} + {fmt(n(creditAfter))}</div>
        <div className="font-bold mb-1">= {fmt(r.adjustedCost)} Tk</div>

        <div className="font-bold mb-0.5">STEP 2 - Main meter reading diff</div>
        <div>{fmt(n(mainCurr))} - {fmt(n(mainPrev))}</div>
        <div className="font-bold mb-1">= {fmt(r.mainUsage)} kWh</div>

        <div className="font-bold mb-0.5">STEP 3 - Unit price</div>
        <div>{fmt(r.adjustedCost)} / {fmt(r.mainUsage)}</div>
        <div className="font-bold mb-1">= {r.unitPrice.toFixed(6)} Tk/kWh</div>

        <div className="font-bold mb-0.5">STEP 4 - Sub meter reading diff</div>
        <div>{fmt(n(subCurr))} - {fmt(n(subPrev))}</div>
        <div className="font-bold mb-1">= {fmt(r.subUsage)} kWh</div>

        <div className="font-bold mb-0.5">STEP 5 - Sub meter cost</div>
        <div>{fmt(r.subUsage)} x {r.unitPrice.toFixed(6)}</div>
        <div>= {fmt(r.subCostRaw)} Tk</div>
        <div className="italic text-[8px]">+ half of demand charge:</div>
        <div>({fmt(n(totalPaid))} - {fmt(n(energyCost))}) / 2 = {fmt(r.halfCharge)}</div>
        <div className="font-bold mb-1">{fmt(r.subCostRaw)} + {fmt(r.halfCharge)} = {fmt(r.subTotal)} Tk</div>

        <div className="font-bold mb-0.5">STEP 6 - Main-only usage</div>
        <div className="italic text-[8px]">(main reading includes sub's draw)</div>
        <div>{fmt(r.mainUsage)} - {fmt(r.subUsage)}</div>
        <div className="font-bold mb-1">= {fmt(r.mainOnlyUsage)} kWh</div>

        <div className="font-bold mb-0.5">STEP 7 - Main meter cost</div>
        <div>{fmt(r.mainOnlyUsage)} x {r.unitPrice.toFixed(6)}</div>
        <div>= {fmt(r.mainCostRaw)} Tk</div>
        <div className="font-bold mb-1">{fmt(r.mainCostRaw)} + {fmt(r.halfCharge)} = {fmt(r.mainTotal)} Tk</div>

        <div className="border-t border-black my-1" />
        <div className="flex justify-between font-bold text-[10px]">
          <span>MAIN METER TOTAL</span>
          <span>{fmt(r.mainTotal)} Tk</span>
        </div>
        <div className="flex justify-between font-bold text-[10px] mb-1">
          <span>SUB METER TOTAL</span>
          <span>{fmt(r.subTotal)} Tk</span>
        </div>
        <div className="border-t border-dashed border-black my-1" />
        <div className="text-center italic text-[8px]">Thank you</div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-4 no-print">
          <div className="bg-[#12160F] border border-[#212B1D] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#212B1D]">
              <h3 className="text-[#EAF7E4] text-sm font-medium uppercase tracking-wide">
                Saved calculations
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
                  No saved calculations yet. Tap "Save" on the main screen to keep a record.
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
    </div>
  );
}
