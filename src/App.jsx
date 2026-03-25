import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Bundesland Data ───
const BUNDESLAENDER = [
  { name: "Baden-Württemberg", steuer: 5.0, makler: 3.57 },
  { name: "Bayern", steuer: 3.5, makler: 3.57 },
  { name: "Berlin", steuer: 6.0, makler: 3.57 },
  { name: "Brandenburg", steuer: 6.5, makler: 3.57 },
  { name: "Bremen", steuer: 5.0, makler: 2.98 },
  { name: "Hamburg", steuer: 5.5, makler: 3.13 },
  { name: "Hessen", steuer: 6.0, makler: 2.98 },
  { name: "Mecklenburg-Vorpommern", steuer: 6.0, makler: 2.98 },
  { name: "Niedersachsen", steuer: 5.0, makler: 3.57 },
  { name: "Nordrhein-Westfalen", steuer: 6.5, makler: 3.57 },
  { name: "Rheinland-Pfalz", steuer: 5.0, makler: 3.57 },
  { name: "Saarland", steuer: 6.5, makler: 3.57 },
  { name: "Sachsen", steuer: 3.5, makler: 3.57 },
  { name: "Sachsen-Anhalt", steuer: 5.0, makler: 3.57 },
  { name: "Schleswig-Holstein", steuer: 6.5, makler: 3.57 },
  { name: "Thüringen", steuer: 5.0, makler: 3.57 },
];

const ZINSBINDUNGEN = [5, 10, 15, 20, 25, 30];

const BONITAET_LABELS = { top: "Sehr gut", mittel: "Durchschnitt", schwach: "Schwach" };
const BONITAET_AUFSCHLAG = { top: 0, mittel: 0.3, schwach: 0.7 };

const COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

// ─── Helpers ───
const fmt = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtD = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const pct = (n) => `${n.toFixed(2).replace(".", ",")} %`;

function berechneBasiszins(eigenkapitalQuote, zinsbindung, bonitaet) {
  let basis = 3.2;
  if (zinsbindung <= 5) basis -= 0.4;
  else if (zinsbindung <= 10) basis -= 0.1;
  else if (zinsbindung <= 15) basis += 0.1;
  else if (zinsbindung <= 20) basis += 0.25;
  else if (zinsbindung <= 25) basis += 0.35;
  else basis += 0.5;
  if (eigenkapitalQuote > 30) basis -= 0.3;
  else if (eigenkapitalQuote > 20) basis -= 0.15;
  else if (eigenkapitalQuote < 10) basis += 0.4;
  basis += BONITAET_AUFSCHLAG[bonitaet];
  return Math.max(1.5, Math.round(basis * 100) / 100);
}

function berechneTilgungsplan(kredit, zinsSatz, tilgungsSatz, zinsbindung) {
  const monatszins = zinsSatz / 100 / 12;
  const monatsRate = (kredit * (zinsSatz / 100 + tilgungsSatz / 100)) / 12;
  let restschuld = kredit;
  const plan = [];
  let gesamtZinsen = 0;
  let gesamtTilgung = 0;
  for (let jahr = 1; jahr <= Math.min(zinsbindung, 40); jahr++) {
    let jahresZinsen = 0;
    let jahresTilgung = 0;
    for (let m = 0; m < 12; m++) {
      if (restschuld <= 0) break;
      const zinsAnteil = restschuld * monatszins;
      const tilgungsAnteil = Math.min(monatsRate - zinsAnteil, restschuld);
      jahresZinsen += zinsAnteil;
      jahresTilgung += tilgungsAnteil;
      restschuld -= tilgungsAnteil;
    }
    gesamtZinsen += jahresZinsen;
    gesamtTilgung += jahresTilgung;
    plan.push({
      jahr,
      zinsen: Math.round(jahresZinsen),
      tilgung: Math.round(jahresTilgung),
      restschuld: Math.max(0, Math.round(restschuld)),
      gesamtZinsen: Math.round(gesamtZinsen),
      gesamtTilgung: Math.round(gesamtTilgung),
    });
    if (restschuld <= 0) break;
  }
  return { plan, monatsRate, gesamtZinsen, restschuldEnde: Math.max(0, Math.round(restschuld)) };
}

// ─── Components ───
function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center mb-8 flex-wrap gap-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-300 ${i < current ? "bg-green-500 text-white" : i === current ? "bg-blue-600 text-white ring-4 ring-blue-200" : "bg-gray-200 text-gray-500"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`ml-2 text-sm hidden sm:inline ${i === current ? "font-semibold text-blue-700" : "text-gray-500"}`}>{s}</span>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-2 ${i < current ? "bg-green-400" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function InputField({ label, value, onChange, suffix, prefix, type = "number", min, max, step, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          min={min}
          max={max}
          step={step || 1}
          className={`w-full border border-gray-300 rounded-lg py-2.5 text-gray-800 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition ${prefix ? "pl-8" : "pl-4"} ${suffix ? "pr-12" : "pr-4"}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer mb-4">
      <div className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function BigNumber({ label, value, sub, color = "text-blue-700" }) {
  return (
    <div className="text-center p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main App ───
export default function ImmobilienFinanzberater() {
  const STEPS = ["Immobilie", "Nebenkosten", "Eigenkapital", "Finanzierung", "Ergebnis"];
  const [step, setStep] = useState(0);

  // Step 1 - Immobilie
  const [kaufpreis, setKaufpreis] = useState(350000);
  const [bundeslandIdx, setBundeslandIdx] = useState(1); // Bayern

  // Step 2 - Nebenkosten
  const [mitMakler, setMitMakler] = useState(true);
  const [maklerProzent, setMaklerProzent] = useState(BUNDESLAENDER[1].makler);
  const [modernisierung, setModernisierung] = useState(0);

  // Step 3 - Eigenkapital
  const [eigenkapital, setEigenkapital] = useState(70000);

  // Step 4 - Finanzierung
  const [zinsbindung, setZinsbindung] = useState(15);
  const [tilgung, setTilgung] = useState(2);
  const [bonitaet, setBonitaet] = useState("mittel");
  const [zinsManual, setZinsManual] = useState(null);

  // Szenarien
  const [szenarien, setSzenarien] = useState([]);

  // ─── Berechnungen ───
  const bl = BUNDESLAENDER[bundeslandIdx];
  const grunderwerbsteuer = kaufpreis * (bl.steuer / 100);
  const notarkosten = kaufpreis * 0.02;
  const maklerkosten = mitMakler ? kaufpreis * (maklerProzent / 100) : 0;
  const nebenkosten = grunderwerbsteuer + notarkosten + maklerkosten;
  const gesamtkosten = kaufpreis + nebenkosten + modernisierung;
  const kreditbedarf = Math.max(0, gesamtkosten - eigenkapital);
  const eigenkapitalQuote = gesamtkosten > 0 ? (eigenkapital / gesamtkosten) * 100 : 0;

  const basisZins = berechneBasiszins(eigenkapitalQuote, zinsbindung, bonitaet);
  const zinsSatz = zinsManual !== null ? zinsManual : basisZins;

  const ergebnis = useMemo(() => berechneTilgungsplan(kreditbedarf, zinsSatz, tilgung, zinsbindung), [kreditbedarf, zinsSatz, tilgung, zinsbindung]);

  // Eigenkapital Impact
  const ekPlus = useMemo(() => {
    const kPlus = Math.max(0, gesamtkosten - (eigenkapital + 10000));
    const res = berechneTilgungsplan(kPlus, zinsSatz, tilgung, zinsbindung);
    return res.monatsRate;
  }, [gesamtkosten, eigenkapital, zinsSatz, tilgung, zinsbindung]);

  const ekMinus = useMemo(() => {
    const kMinus = Math.max(0, gesamtkosten - Math.max(0, eigenkapital - 10000));
    const res = berechneTilgungsplan(kMinus, zinsSatz, tilgung, zinsbindung);
    return res.monatsRate;
  }, [gesamtkosten, eigenkapital, zinsSatz, tilgung, zinsbindung]);

  // Szenario-Vergleich
  const szenarioErgebnisse = useMemo(() => {
    return szenarien.map((s) => {
      const res = berechneTilgungsplan(kreditbedarf, s.zins, s.tilgung, s.zinsbindung);
      const laufzeit = res.plan.length;
      return { ...s, ...res, laufzeit };
    });
  }, [szenarien, kreditbedarf]);

  const addSzenario = () => {
    setSzenarien((prev) => [...prev, { id: Date.now(), zins: zinsSatz, tilgung, zinsbindung, label: `Szenario ${prev.length + 2}` }]);
  };

  const removeSzenario = (id) => setSzenarien((prev) => prev.filter((s) => s.id !== id));

  const handleBundeslandChange = (idx) => {
    setBundeslandIdx(idx);
    setMaklerProzent(BUNDESLAENDER[idx].makler);
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Nebenkosten Pie Data ───
  const nebenkostenPie = [
    { name: "Grunderwerbsteuer", value: grunderwerbsteuer },
    { name: "Notarkosten", value: notarkosten },
    ...(maklerkosten > 0 ? [{ name: "Maklerkosten", value: maklerkosten }] : []),
    ...(modernisierung > 0 ? [{ name: "Modernisierung", value: modernisierung }] : []),
  ];

  // ─── Kosten-Pie für Ergebnis ───
  const kostenPie = [
    { name: "Kaufpreis", value: kaufpreis },
    { name: "Nebenkosten", value: nebenkosten + modernisierung },
    { name: "Gesamtzinsen", value: ergebnis.gesamtZinsen },
  ];

  // ─── Anschlussfinanzierung ───
  const anschlussZins = zinsSatz + 1.0;
  const anschlussErgebnis = useMemo(() => {
    if (ergebnis.restschuldEnde > 0) {
      return berechneTilgungsplan(ergebnis.restschuldEnde, anschlussZins, tilgung + 1, 15);
    }
    return null;
  }, [ergebnis.restschuldEnde, anschlussZins, tilgung]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow">F</div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">FinanzPilot</h1>
              <p className="text-xs text-gray-400">Immobilienfinanzierung leicht gemacht</p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">Unverbindliche Beispielrechnung</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <StepIndicator steps={STEPS} current={step} />

        {/* ── STEP 1: Immobilie ── */}
        {step === 0 && (
          <Card title="Ihre Immobilie">
            <div className="grid sm:grid-cols-2 gap-6">
              <InputField label="Kaufpreis der Immobilie" value={kaufpreis} onChange={setKaufpreis} suffix="€" min={10000} step={5000} hint="Der Kaufpreis laut Exposé" />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundesland</label>
                <select
                  value={bundeslandIdx}
                  onChange={(e) => handleBundeslandChange(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-gray-800 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                >
                  {BUNDESLAENDER.map((b, i) => (
                    <option key={i} value={i}>{b.name} ({pct(b.steuer)} GrESt)</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Grunderwerbsteuer: {pct(bl.steuer)} = {fmt(grunderwerbsteuer)}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={next} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">Weiter</button>
            </div>
          </Card>
        )}

        {/* ── STEP 2: Nebenkosten ── */}
        {step === 1 && (
          <Card title="Nebenkosten & Modernisierung">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-gray-600">Notarkosten (ca. 2%)</p>
                  <p className="text-xl font-bold text-gray-800">{fmt(notarkosten)}</p>
                </div>
                <Toggle label="Maklerkosten einbeziehen" checked={mitMakler} onChange={setMitMakler} />
                {mitMakler && (
                  <InputField label="Maklerprovision (Käuferanteil)" value={maklerProzent} onChange={setMaklerProzent} suffix="%" step={0.01} min={0} max={7} hint={`Üblich in ${bl.name}: ${pct(bl.makler)}`} />
                )}
                <InputField label="Modernisierungskosten" value={modernisierung} onChange={setModernisierung} suffix="€" min={0} step={1000} hint="Renovierung, Sanierung, etc." />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-3">Kostenübersicht</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={nebenkostenPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {nebenkostenPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="bg-blue-50 rounded-xl p-4 mt-2 text-center">
                  <p className="text-sm text-blue-600">Gesamte Nebenkosten + Modernisierung</p>
                  <p className="text-2xl font-bold text-blue-800">{fmt(nebenkosten + modernisierung)}</p>
                  <p className="text-xs text-blue-400">{pct((nebenkosten + modernisierung) / kaufpreis * 100)} vom Kaufpreis</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={prev} className="text-gray-500 px-6 py-2.5 rounded-lg hover:bg-gray-100 transition">Zurück</button>
              <button onClick={next} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">Weiter</button>
            </div>
          </Card>
        )}

        {/* ── STEP 3: Eigenkapital ── */}
        {step === 2 && (
          <Card title="Eigenkapital">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <InputField label="Eingebrachtes Eigenkapital" value={eigenkapital} onChange={setEigenkapital} suffix="€" min={0} step={5000} />
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Gesamtkosten</span><span className="font-semibold">{fmt(gesamtkosten)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">– Eigenkapital</span><span className="font-semibold text-green-600">– {fmt(eigenkapital)}</span></div>
                  <hr />
                  <div className="flex justify-between text-sm"><span className="text-gray-700 font-semibold">= Darlehensbedarf</span><span className="font-bold text-blue-700 text-lg">{fmt(kreditbedarf)}</span></div>
                </div>
                <div className="mt-4 p-4 bg-amber-50 rounded-xl">
                  <p className="text-sm font-medium text-amber-700">Eigenkapitalquote: {pct(eigenkapitalQuote)}</p>
                  <div className="w-full bg-amber-200 rounded-full h-3 mt-2">
                    <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, eigenkapitalQuote)}%` }} />
                  </div>
                  <p className="text-xs text-amber-600 mt-1">{eigenkapitalQuote >= 20 ? "Sehr gute Quote – bessere Konditionen möglich" : eigenkapitalQuote >= 10 ? "Solide Quote" : "Geringe Quote – höherer Zinsaufschlag wahrscheinlich"}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-3">Eigenkapital-Wirkung</h4>
                <div className="space-y-3">
                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-xs text-red-400">Bei -10.000 € Eigenkapital</p>
                    <p className="text-lg font-bold text-red-600">{fmtD(ekMinus)} / Monat</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                    <p className="text-xs text-blue-400">Aktuell ({fmt(eigenkapital)})</p>
                    <p className="text-lg font-bold text-blue-700">{fmtD(ergebnis.monatsRate)} / Monat</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-green-400">Bei +10.000 € Eigenkapital</p>
                    <p className="text-lg font-bold text-green-600">{fmtD(ekPlus)} / Monat</p>
                    <p className="text-xs text-green-500 mt-1">Ersparnis: {fmtD(ergebnis.monatsRate - ekPlus)} / Monat</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={prev} className="text-gray-500 px-6 py-2.5 rounded-lg hover:bg-gray-100 transition">Zurück</button>
              <button onClick={next} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">Weiter</button>
            </div>
          </Card>
        )}

        {/* ── STEP 4: Finanzierung ── */}
        {step === 3 && (
          <Card title="Finanzierungsparameter">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zinsbindung</label>
                  <div className="flex flex-wrap gap-2">
                    {ZINSBINDUNGEN.map((z) => (
                      <button key={z} onClick={() => { setZinsbindung(z); setZinsManual(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${z === zinsbindung ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {z} Jahre
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bonität</label>
                  <div className="flex gap-2">
                    {Object.entries(BONITAET_LABELS).map(([key, label]) => (
                      <button key={key} onClick={() => { setBonitaet(key); setZinsManual(null); }} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${key === bonitaet ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-600">Ermittelter Sollzinssatz</p>
                  <p className="text-3xl font-bold text-blue-800">{pct(zinsSatz)}</p>
                  <p className="text-xs text-blue-400 mt-1">Basierend auf EK-Quote, Zinsbindung & Bonität</p>
                </div>
                <InputField label="Zinssatz manuell anpassen (optional)" value={zinsManual !== null ? zinsManual : basisZins} onChange={(v) => setZinsManual(v)} suffix="%" step={0.05} min={0.5} max={10} hint="Überschreibt den ermittelten Zinssatz" />
              </div>
              <div>
                <InputField label="Anfängliche Tilgung" value={tilgung} onChange={setTilgung} suffix="%" step={0.5} min={1} max={10} hint="Mindestens 1 %, empfohlen: 2-3 %" />
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Darlehensbetrag</span><span className="font-semibold">{fmt(kreditbedarf)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Annuität (Zins + Tilgung)</span><span className="font-semibold">{pct(zinsSatz + tilgung)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Jahresrate</span><span className="font-semibold">{fmt(ergebnis.monatsRate * 12)}</span></div>
                  <hr />
                  <div className="flex justify-between"><span className="text-gray-700 font-semibold">Monatsrate</span><span className="font-bold text-blue-700 text-xl">{fmtD(ergebnis.monatsRate)}</span></div>
                </div>
                <div className="mt-4 bg-amber-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-700">Restschuld nach {zinsbindung} Jahren</p>
                  <p className="text-2xl font-bold text-amber-800">{fmt(ergebnis.restschuldEnde)}</p>
                  <p className="text-xs text-amber-500">{ergebnis.restschuldEnde > 0 ? "Anschlussfinanzierung erforderlich" : "Darlehen vollständig getilgt!"}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={prev} className="text-gray-500 px-6 py-2.5 rounded-lg hover:bg-gray-100 transition">Zurück</button>
              <button onClick={next} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">Ergebnis anzeigen</button>
            </div>
          </Card>
        )}

        {/* ── STEP 5: Ergebnis ── */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Hero Result */}
            <Card className="bg-gradient-to-r from-blue-600 to-blue-800 text-white border-none">
              <div className="grid sm:grid-cols-3 gap-4">
                <BigNumber label="Monatliche Rate" value={fmtD(ergebnis.monatsRate)} color="text-white" />
                <BigNumber label="Darlehensbetrag" value={fmt(kreditbedarf)} color="text-blue-200" />
                <BigNumber label={`Restschuld nach ${zinsbindung} J.`} value={fmt(ergebnis.restschuldEnde)} color="text-blue-200" />
              </div>
            </Card>

            {/* Zusammenfassung */}
            <div className="grid sm:grid-cols-2 gap-6">
              <Card title="Kostenübersicht">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Kaufpreis</span><span className="font-medium">{fmt(kaufpreis)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Grunderwerbsteuer ({pct(bl.steuer)})</span><span className="font-medium">{fmt(grunderwerbsteuer)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Notarkosten (2%)</span><span className="font-medium">{fmt(notarkosten)}</span></div>
                  {mitMakler && <div className="flex justify-between"><span className="text-gray-500">Makler ({pct(maklerProzent)})</span><span className="font-medium">{fmt(maklerkosten)}</span></div>}
                  {modernisierung > 0 && <div className="flex justify-between"><span className="text-gray-500">Modernisierung</span><span className="font-medium">{fmt(modernisierung)}</span></div>}
                  <hr />
                  <div className="flex justify-between font-semibold"><span>Gesamtkosten</span><span>{fmt(gesamtkosten)}</span></div>
                  <div className="flex justify-between text-green-600"><span>– Eigenkapital</span><span>– {fmt(eigenkapital)}</span></div>
                  <hr />
                  <div className="flex justify-between font-bold text-blue-700"><span>Darlehensbedarf</span><span>{fmt(kreditbedarf)}</span></div>
                </div>
              </Card>
              <Card title="Finanzierungsdetails">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Bundesland</span><span className="font-medium">{bl.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sollzinssatz</span><span className="font-medium">{pct(zinsSatz)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Anfängliche Tilgung</span><span className="font-medium">{pct(tilgung)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Zinsbindung</span><span className="font-medium">{zinsbindung} Jahre</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Bonität</span><span className="font-medium">{BONITAET_LABELS[bonitaet]}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Eigenkapitalquote</span><span className="font-medium">{pct(eigenkapitalQuote)}</span></div>
                  <hr />
                  <div className="flex justify-between"><span className="text-gray-500">Gezahlte Zinsen ({zinsbindung} J.)</span><span className="font-medium text-red-600">{fmt(ergebnis.gesamtZinsen)}</span></div>
                  <div className="flex justify-between font-bold"><span>Gesamtkosten inkl. Zinsen</span><span>{fmt(kaufpreis + nebenkosten + modernisierung + ergebnis.gesamtZinsen)}</span></div>
                </div>
              </Card>
            </div>

            {/* Gesamtkosten-Torte */}
            <Card title="Gesamtkosten-Aufteilung">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={kostenPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {kostenPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Tilgungsverlauf */}
            <Card title="Tilgungsverlauf">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={ergebnis.plan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="jahr" label={{ value: "Jahr", position: "insideBottom", offset: -5 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="restschuld" name="Restschuld" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Zinsen vs Tilgung pro Jahr */}
            <Card title="Zinsen vs. Tilgung pro Jahr">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ergebnis.plan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="jahr" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="zinsen" name="Zinsen" fill="#ef4444" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="tilgung" name="Tilgung" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Anschlussfinanzierung */}
            {anschlussErgebnis && ergebnis.restschuldEnde > 0 && (
              <Card title="Anschlussfinanzierung (Simulation)">
                <p className="text-sm text-gray-500 mb-4">Annahme: Anschlusszins {pct(anschlussZins)}, Tilgung {pct(tilgung + 1)}, 15 Jahre Zinsbindung</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-400">Restschuld</p>
                    <p className="text-xl font-bold text-orange-700">{fmt(ergebnis.restschuldEnde)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-400">Neue Monatsrate</p>
                    <p className="text-xl font-bold text-orange-700">{fmtD(anschlussErgebnis.monatsRate)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-400">Restschuld nach 15 J.</p>
                    <p className="text-xl font-bold text-orange-700">{fmt(anschlussErgebnis.restschuldEnde)}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Szenario-Vergleich */}
            <Card title="Szenario-Vergleich">
              <p className="text-sm text-gray-500 mb-4">Vergleichen Sie verschiedene Finanzierungsszenarien miteinander.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Szenario</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Zins</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Tilgung</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Rate/Monat</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Restschuld</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Ges. Zinsen</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 bg-blue-50">
                      <td className="py-2 px-3 font-medium text-blue-700">Aktuell</td>
                      <td className="py-2 px-3 text-right">{pct(zinsSatz)}</td>
                      <td className="py-2 px-3 text-right">{pct(tilgung)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmtD(ergebnis.monatsRate)}</td>
                      <td className="py-2 px-3 text-right">{fmt(ergebnis.restschuldEnde)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{fmt(ergebnis.gesamtZinsen)}</td>
                      <td className="py-2 px-3"></td>
                    </tr>
                    {szenarioErgebnisse.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{s.label}</td>
                        <td className="py-2 px-3 text-right">{pct(s.zins)}</td>
                        <td className="py-2 px-3 text-right">{pct(s.tilgung)}</td>
                        <td className="py-2 px-3 text-right font-semibold">{fmtD(s.monatsRate)}</td>
                        <td className="py-2 px-3 text-right">{fmt(s.restschuldEnde)}</td>
                        <td className="py-2 px-3 text-right text-red-600">{fmt(s.gesamtZinsen)}</td>
                        <td className="py-2 px-3">
                          <button onClick={() => removeSzenario(s.id)} className="text-red-400 hover:text-red-600 text-xs">Entfernen</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {szenarien.length > 0 && szenarien.length < 4 && (
                <div className="mt-4 space-y-3">
                  {szenarien.map((s) => (
                    <div key={s.id} className="flex flex-wrap gap-3 items-end bg-gray-50 rounded-lg p-3">
                      <span className="text-sm font-medium text-gray-600 w-24">{s.label}</span>
                      <div>
                        <label className="text-xs text-gray-400">Zins %</label>
                        <input type="number" value={s.zins} step={0.1} min={0.5} max={10}
                          onChange={(e) => setSzenarien((prev) => prev.map((x) => x.id === s.id ? { ...x, zins: parseFloat(e.target.value) || 0 } : x))}
                          className="w-20 border rounded px-2 py-1 text-sm ml-1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Tilgung %</label>
                        <input type="number" value={s.tilgung} step={0.5} min={1} max={10}
                          onChange={(e) => setSzenarien((prev) => prev.map((x) => x.id === s.id ? { ...x, tilgung: parseFloat(e.target.value) || 1 } : x))}
                          className="w-20 border rounded px-2 py-1 text-sm ml-1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Bindung</label>
                        <select value={s.zinsbindung}
                          onChange={(e) => setSzenarien((prev) => prev.map((x) => x.id === s.id ? { ...x, zinsbindung: parseInt(e.target.value) } : x))}
                          className="border rounded px-2 py-1 text-sm ml-1">
                          {ZINSBINDUNGEN.map((z) => <option key={z} value={z}>{z} J.</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addSzenario} disabled={szenarien.length >= 4}
                className="mt-4 bg-gray-100 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-40">
                + Szenario hinzufügen
              </button>
            </Card>

            {/* Eigenkapital Impact nochmal */}
            <Card title="Eigenkapital-Wirkung">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-red-400">– 10.000 € EK</p>
                  <p className="text-xl font-bold text-red-600">{fmtD(ekMinus)} / Monat</p>
                  <p className="text-xs text-red-400">+ {fmtD(ekMinus - ergebnis.monatsRate)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center border-2 border-blue-200">
                  <p className="text-xs text-blue-400">Aktuell</p>
                  <p className="text-xl font-bold text-blue-700">{fmtD(ergebnis.monatsRate)} / Monat</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-green-400">+ 10.000 € EK</p>
                  <p className="text-xl font-bold text-green-600">{fmtD(ekPlus)} / Monat</p>
                  <p className="text-xs text-green-500">– {fmtD(ergebnis.monatsRate - ekPlus)}</p>
                </div>
              </div>
            </Card>

            {/* Zurück & Hinweis */}
            <div className="flex justify-between items-center">
              <button onClick={() => setStep(0)} className="text-blue-600 px-6 py-2.5 rounded-lg hover:bg-blue-50 transition font-medium">Neue Berechnung starten</button>
              <button onClick={prev} className="text-gray-500 px-6 py-2.5 rounded-lg hover:bg-gray-100 transition">Zurück</button>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-50 rounded-xl p-5 text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                Diese Berechnung ist eine unverbindliche Beispielrechnung und stellt kein verbindliches Finanzierungsangebot dar.
                Die tatsächlichen Konditionen können je nach Kreditinstitut, Bonität und weiteren Faktoren abweichen.
                Bitte konsultieren Sie einen qualifizierten Finanzberater für eine individuelle Beratung.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>FinanzPilot – Unverbindliche Beispielrechnung · Keine Finanzberatung · Alle Angaben ohne Gewähr</p>
        </div>
      </footer>
    </div>
  );
}
