"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isInView };
}

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────── Navbar ───────────────────── */

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-xl font-bold text-primary">
          Doklady AI
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#funkce"
            className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
          >
            Funkce
          </a>
          <a
            href="#cenik"
            className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
          >
            Ceník
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
          >
            FAQ
          </a>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Přihlásit se
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 transition-colors shadow-sm"
          >
            Začít zdarma
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-slate-700"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-5 pb-6 pt-2 space-y-4">
          <a
            href="#funkce"
            className="block text-sm font-medium text-slate-700"
            onClick={() => setOpen(false)}
          >
            Funkce
          </a>
          <a
            href="#cenik"
            className="block text-sm font-medium text-slate-700"
            onClick={() => setOpen(false)}
          >
            Ceník
          </a>
          <a
            href="#faq"
            className="block text-sm font-medium text-slate-700"
            onClick={() => setOpen(false)}
          >
            FAQ
          </a>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center hover:bg-slate-50 transition-colors"
            >
              Přihlásit se
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white text-center hover:bg-accent-600 transition-colors"
            >
              Začít zdarma
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ───────────────────── Hero ───────────────────── */

function Hero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-28 px-5">
      <div className="mx-auto max-w-4xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-tight text-balance"
        >
          Faktury zpracované za sekundy, ne hodiny
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
        >
          Nahrajte fakturu nebo ji pošlete emailem. AI vytěží všechna data
          a rovnou je pošle do Fakturoidu. Bez přepisování, bez chyb.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-md hover:bg-accent-600 hover:shadow-lg transition-all"
          >
            Začít zdarma
          </Link>
          <a
            href="#funkce"
            className="text-base font-semibold text-slate-600 hover:text-primary transition-colors"
          >
            Jak to funguje? &darr;
          </a>
        </motion.div>

        {/* App mockup placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-16 mx-auto max-w-3xl"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-slate-400">
                doklady.fun/dashboard
              </span>
            </div>
            <div className="p-8 sm:p-12 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                  AI
                </div>
                <div>
                  <div className="h-3 w-48 bg-slate-200 rounded" />
                  <div className="h-2 w-32 bg-slate-100 rounded mt-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["Dodavatel", "Částka", "DPH", "VS"].map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {label}
                    </div>
                    <div className="mt-1 h-3 w-full bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-32 rounded-lg bg-accent/20" />
                <div className="h-8 w-28 rounded-lg bg-slate-100" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────── Social proof ───────────────────── */

function SocialProof() {
  const stats = [
    { value: "1 234+", label: "zpracovaných faktur" },
    { value: "412+", label: "ušetřených hodin" },
    { value: "98 %", label: "přesnost vytěžení" },
  ];
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-12 px-5">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-wider mb-8">
          Používají živnostníci po celé ČR
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          {stats.map((s) => (
            <FadeIn key={s.label} className="text-center">
              <div className="text-3xl font-bold text-primary">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Jak to funguje ───────────────────── */

function HowItWorks() {
  const steps = [
    {
      icon: "📤",
      title: "Nahrajte nebo pošlete emailem",
      desc: "Přetáhněte PDF, vyfotografujte účtenku nebo nastavte přeposílání emailů. Podporujeme PDF, JPG, PNG.",
    },
    {
      icon: "🤖",
      title: "AI vytěží data za sekundy",
      desc: "Umělá inteligence přečte fakturu a vytáhne všechna důležitá data — dodavatel, částka, DPH, položky.",
    },
    {
      icon: "✅",
      title: "Rovnou do účetnictví",
      desc: "Jedním klikem odešlete do Fakturoidu nebo stáhněte XML pro Money S3, Pohodu a další.",
    },
  ];

  return (
    <section id="funkce" className="py-20 md:py-28 px-5">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Jak to funguje
          </h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Tři jednoduché kroky od faktury k zápisu v účetnictví
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.1}>
              <div className="relative rounded-2xl border border-slate-200 bg-white p-8 hover:shadow-md transition-shadow">
                <span className="absolute -top-4 -left-2 bg-accent text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow">
                  {i + 1}
                </span>
                <div className="text-3xl mb-4">{step.icon}</div>
                <h3 className="text-lg font-semibold text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Funkce grid ───────────────────── */

function Features() {
  const features = [
    {
      icon: "📧",
      title: "Email příjem",
      desc: "Pošlete fakturu na vaši unikátní adresu. Automaticky zpracujeme.",
    },
    {
      icon: "🔗",
      title: "Fakturoid integrace",
      desc: "Přímé nahrání nákladu do Fakturoidu jedním klikem. Bez kopírování.",
    },
    {
      icon: "📊",
      title: "Money S3 export",
      desc: "XML export pro Money S3, Pohodu a iDoklad. Stáhněte a importujte.",
    },
    {
      icon: "🗄️",
      title: "Bezpečné úložiště",
      desc: "Všechny faktury bezpečně uložené v cloudu. 2 GB zdarma v Basic tarifu.",
    },
    {
      icon: "✏️",
      title: "Ruční korekce",
      desc: "AI není neomylná. Vytěžená data jednoduše opravíte.",
    },
    {
      icon: "📱",
      title: "Funguje na mobilu",
      desc: "Vyfotografujte účtenku přes mobil přímo do aplikace.",
    },
  ];

  return (
    <section className="py-20 md:py-28 px-5 bg-slate-50/50">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Všechno, co potřebujete
          </h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Kompletní nástroj pro správu přijatých faktur
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.05}>
              <div className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-primary mb-1">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Ceník ───────────────────── */

function Pricing() {
  const [yearly, setYearly] = useState(false);

  const plans = [
    {
      name: "Free",
      monthly: 0,
      yearlyTotal: 0,
      badge: null,
      docs: "5 dokladů / měsíc",
      storage: "100 MB úložiště",
      extras: [] as string[],
      cta: "Začít zdarma",
      href: "/register",
      highlight: false,
    },
    {
      name: "Basic",
      monthly: 299,
      yearlyTotal: 2990,
      badge: "Nejoblíbenější",
      docs: "30 dokladů / měsíc",
      storage: "2 GB úložiště",
      extras: ["Prioritní podpora"],
      cta: "Vybrat Basic",
      href: "/register?plan=basic",
      highlight: true,
    },
    {
      name: "Pro",
      monthly: 499,
      yearlyTotal: 4990,
      badge: null,
      docs: "100 dokladů / měsíc",
      storage: "10 GB úložiště",
      extras: ["API přístup (brzy)"],
      cta: "Vybrat Pro",
      href: "/register?plan=pro",
      highlight: false,
    },
  ];

  const common = [
    "Fakturoid integrace",
    "Email příjem faktur",
    "Money S3 export",
  ];

  return (
    <section id="cenik" className="py-20 md:py-28 px-5">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Jednoduchý ceník
          </h2>
          <p className="mt-4 text-slate-500">
            Začněte zdarma, upgradujte až budete potřebovat
          </p>

          {/* Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className={`text-sm font-medium ${
                !yearly ? "text-primary" : "text-slate-400"
              }`}
            >
              Měsíčně
            </span>
            <button
              onClick={() => setYearly(!yearly)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                yearly ? "bg-accent" : "bg-slate-300"
              }`}
              aria-label="Přepnout měsíční/roční"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  yearly ? "translate-x-6" : ""
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                yearly ? "text-primary" : "text-slate-400"
              }`}
            >
              Ročně
            </span>
            {yearly && (
              <span className="text-xs font-semibold text-accent bg-accent-50 px-2 py-0.5 rounded-full">
                2 měsíce zdarma
              </span>
            )}
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.1}>
              <div
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlight
                    ? "border-accent bg-white shadow-lg scale-[1.02]"
                    : "border-slate-200 bg-white hover:shadow-md"
                } transition-all`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-primary">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-primary">
                    {plan.monthly === 0
                      ? "0"
                      : yearly
                      ? Math.round(plan.yearlyTotal / 12)
                      : plan.monthly}
                  </span>
                  <span className="text-slate-500 ml-1 text-sm">
                    {plan.monthly === 0 ? "Kč" : "Kč / měsíc"}
                  </span>
                </div>
                {yearly && plan.yearlyTotal > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {plan.yearlyTotal.toLocaleString("cs-CZ")} Kč ročně
                  </p>
                )}

                <ul className="mt-6 space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-accent mt-0.5">&#10003;</span>
                    {plan.docs}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-accent mt-0.5">&#10003;</span>
                    {plan.storage}
                  </li>
                  {common.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span className="text-accent mt-0.5">&#10003;</span>
                      {c}
                    </li>
                  ))}
                  {plan.extras.map((e) => (
                    <li
                      key={e}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span className="text-accent mt-0.5">&#10003;</span>
                      {e}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 block text-center rounded-xl py-3 text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-accent text-white hover:bg-accent-600 shadow-sm"
                      : "border border-slate-300 text-primary hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Srovnání ───────────────────── */

function Comparison() {
  const rows = [
    { label: "Cena od", us: "299 Kč", them: "349 Kč" },
    { label: "Fakturoid integrace", us: true, them: false },
    { label: "Email příjem", us: true, them: false },
    { label: "AI vytěžování", us: true, them: true },
    { label: "Úložiště", us: "2 GB", them: "2 GB" },
  ];

  return (
    <section className="py-20 md:py-28 px-5 bg-slate-50/50">
      <div className="mx-auto max-w-2xl">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Proč Doklady AI?
          </h2>
          <p className="mt-4 text-slate-500">
            Srovnání s konkurencí
          </p>
        </FadeIn>

        <FadeIn>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-4 font-medium text-slate-500" />
                  <th className="p-4 font-semibold text-primary">
                    Doklady AI
                  </th>
                  <th className="p-4 font-medium text-slate-400">Lyxa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-slate-50 last:border-0">
                    <td className="p-4 text-slate-600">{r.label}</td>
                    <td className="p-4 text-center font-medium text-primary">
                      {typeof r.us === "boolean" ? (
                        r.us ? (
                          <span className="text-green-500 text-lg">&#10003;</span>
                        ) : (
                          <span className="text-red-400 text-lg">&#10007;</span>
                        )
                      ) : (
                        r.us
                      )}
                    </td>
                    <td className="p-4 text-center text-slate-500">
                      {typeof r.them === "boolean" ? (
                        r.them ? (
                          <span className="text-green-500 text-lg">&#10003;</span>
                        ) : (
                          <span className="text-red-400 text-lg">&#10007;</span>
                        )
                      ) : (
                        r.them
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ───────────────────── FAQ ───────────────────── */

function FaqItem({
  q,
  a,
  delay,
}: {
  q: string;
  a: string;
  delay: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FadeIn delay={delay}>
      <div className="border-b border-slate-100 last:border-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full py-5 text-left"
        >
          <span className="font-medium text-primary pr-4">{q}</span>
          <span
            className={`text-slate-400 text-xl transition-transform ${
              open ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </button>
        {open && (
          <p className="pb-5 text-sm text-slate-500 leading-relaxed">{a}</p>
        )}
      </div>
    </FadeIn>
  );
}

function FAQ() {
  const items = [
    {
      q: "Jak přesné je vytěžování?",
      a: "Naše AI dosahuje přesnosti přes 98 % na českých fakturách. Všechna vytěžená data si můžete zkontrolovat a případně opravit před odesláním do účetního systému.",
    },
    {
      q: "Jaké formáty podporujete?",
      a: "Podporujeme PDF faktury, naskenované dokumenty a fotografie ve formátech JPG a PNG. Stačí soubor přetáhnout do aplikace nebo poslat emailem.",
    },
    {
      q: "Jak funguje email příjem?",
      a: "Po registraci dostanete unikátní emailovou adresu. Stačí na ni přeposílat faktury a systém je automaticky zpracuje. Ideální pro nastavení pravidel ve vašem emailovém klientu.",
    },
    {
      q: "Mohu zrušit kdykoli?",
      a: "Ano, předplatné můžete zrušit kdykoli bez jakýchkoli poplatků. Vaše data zůstanou dostupná do konce zaplaceného období.",
    },
    {
      q: "Jsou moje data v bezpečí?",
      a: "Ano. Všechna data jsou šifrována a uložena na serverech v EU. Splňujeme požadavky GDPR a vaše dokumenty nikdy nesdílíme s třetími stranami.",
    },
    {
      q: "Podporujete i jiné účetní systémy než Fakturoid?",
      a: "Ano! Kromě přímé integrace s Fakturoiden nabízíme XML export kompatibilní s Money S3, Pohodou a iDokladem. Na dalších integracích pracujeme.",
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-28 px-5">
      <div className="mx-auto max-w-2xl">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Časté dotazy
          </h2>
        </FadeIn>
        <div className="rounded-2xl border border-slate-200 bg-white px-6">
          {items.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Bottom CTA ───────────────────── */

function BottomCTA() {
  return (
    <section className="py-20 md:py-28 px-5">
      <FadeIn>
        <div className="mx-auto max-w-4xl rounded-3xl bg-primary px-8 py-16 sm:px-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-balance">
            Přestaňte přepisovat faktury ručně
          </h2>
          <p className="mt-4 text-slate-300 text-lg">
            Začněte zdarma, bez platební karty.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-md hover:bg-accent-600 hover:shadow-lg transition-all"
          >
            Vyzkoušet zdarma &rarr;
          </Link>
        </div>
      </FadeIn>
    </section>
  );
}

/* ───────────────────── Footer ───────────────────── */

function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50/50 py-12 px-5">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="text-lg font-bold text-primary">Doklady AI</div>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Automatické vytěžování faktur pro české živnostníky a OSVČ.
            </p>
          </div>

          {/* Produkt */}
          <div>
            <h4 className="font-semibold text-primary text-sm mb-3">
              Produkt
            </h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <a href="#funkce" className="hover:text-primary transition-colors">
                  Funkce
                </a>
              </li>
              <li>
                <a href="#cenik" className="hover:text-primary transition-colors">
                  Ceník
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-primary transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Právní */}
          <div>
            <h4 className="font-semibold text-primary text-sm mb-3">
              Právní
            </h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <span className="text-slate-400">Obchodní podmínky</span>
              </li>
              <li>
                <span className="text-slate-400">Ochrana osobních údajů</span>
              </li>
              <li>
                <span className="text-slate-400">Cookies</span>
              </li>
            </ul>
          </div>

          {/* Kontakt */}
          <div>
            <h4 className="font-semibold text-primary text-sm mb-3">
              Kontakt
            </h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <a
                  href="mailto:info@doklady.fun"
                  className="hover:text-primary transition-colors"
                >
                  info@doklady.fun
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          &copy; 2026 Doklady AI. Všechna práva vyhrazena.
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────── Page ───────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <Features />
      <Pricing />
      <Comparison />
      <FAQ />
      <BottomCTA />
      <Footer />
    </div>
  );
}
