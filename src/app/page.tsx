import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-slate-800">Doklady AI</h1>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Přihlásit se
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              Registrovat
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Automatické vytěžování faktur a účtenek
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Nahrajte doklad jako PDF nebo fotografii a naše AI z něj během
            sekund vytěží všechna důležitá data — dodavatele, částky, DPH,
            datum splatnosti a další.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors"
            >
              Vyzkoušet zdarma
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold leading-6 text-slate-700 hover:text-slate-900"
            >
              Už mám účet →
            </Link>
          </div>

          {/* Features */}
          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-3 text-2xl">📄</div>
              <h3 className="font-semibold text-slate-900">PDF i fotky</h3>
              <p className="mt-2 text-sm text-slate-600">
                Podporujeme faktury v PDF i vyfocené účtenky ve formátu JPG a PNG.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-3 text-2xl">⚡</div>
              <h3 className="font-semibold text-slate-900">Vytěžení za sekundy</h3>
              <p className="mt-2 text-sm text-slate-600">
                AI extrahuje data okamžitě — typ dokladu, IČO, částky, DPH, variabilní symbol.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-3 text-2xl">✏️</div>
              <h3 className="font-semibold text-slate-900">Ruční korekce</h3>
              <p className="mt-2 text-sm text-slate-600">
                Vytěžená data můžete zkontrolovat a upravit přímo v prohlížeči.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        © 2024 Doklady AI
      </footer>
    </div>
  );
}
