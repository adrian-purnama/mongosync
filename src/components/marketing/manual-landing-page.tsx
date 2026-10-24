import type { ReactNode } from "react";

import { Logo, LogoMark } from "@/src/components/brand/logo";
import { ButtonLink } from "@/src/components/ui/button";
import {
  IconAlert,
  IconArchive,
  IconArrowRight,
  IconClock,
  IconDatabase,
  IconFolder,
  IconKey,
  IconLayers,
  IconLock,
  IconRefresh,
  IconShield,
  IconTerminal,
  IconZap,
} from "@/src/components/ui/icons";

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#manual", label: "Manual" },
];

const steps = [
  {
    icon: <IconKey size={18} />,
    title: "Unlock",
    body: "Create a master password on first launch. It's hashed locally and used to derive the key that encrypts your saved connection strings.",
  },
  {
    icon: <IconDatabase size={18} />,
    title: "Connect",
    body: "Group connections by organization. Each MongoDB URL is verified with a real ping before it's saved, then encrypted at rest.",
  },
  {
    icon: <IconRefresh size={18} />,
    title: "Replicate",
    body: "Pick source and target, choose collections and a copy mode, then run. The local server process streams the documents in batches.",
  },
];

const features = [
  {
    icon: <IconShield size={18} />,
    title: "AES-256-GCM at rest",
    body: "Connection strings are encrypted with a key derived from your master password using scrypt. The UI never sees plaintext unless you click reveal.",
  },
  {
    icon: <IconZap size={18} />,
    title: "Streamed batch copies",
    body: "Documents move in batches of 500 in the local Node process, so large collections copy without loading everything into memory.",
  },
  {
    icon: <IconLock size={18} />,
    title: "Locked targets",
    body: "Mark production connections as locked. Locked targets need a typed confirmation, and override mode on them is blocked server-side.",
  },
  {
    icon: <IconArchive size={18} />,
    title: "Export to ZIP",
    body: "Export a whole database or selected collections as a ZIP with one JSON file per collection, ready to download.",
  },
  {
    icon: <IconClock size={18} />,
    title: "Durable job history",
    body: "Jobs and logs persist to disk for 10 days. Restarts are detected, so interrupted jobs are flagged instead of silently lost.",
  },
  {
    icon: <IconLayers size={18} />,
    title: "Three copy modes",
    body: "Override replaces the target, append adds to it, and new copies a single collection under a fresh name.",
  },
];

export function ManualLandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Hero */}
      <div className="relative overflow-hidden bg-ink text-paper">
        <div className="bg-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-sync/25 blur-[120px]" />

        <header className="relative z-10 pt-[var(--titlebar-height)]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
            <Logo tone="dark" size="md" />
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-fog transition hover:bg-white/5 hover:text-paper"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <ButtonLink
              href="/unlock"
              size="sm"
              variant="light"
              icon={<IconLock size={14} />}
            >
              Open app
            </ButtonLink>
          </div>
        </header>

        <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            {/* <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-display text-[11px] uppercase tracking-[0.2em] text-sync-mist">
              <span className="size-1.5 rounded-full bg-sync-glow" />
              Local-first · Windows desktop
            </p> */}
            <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-paper sm:text-[56px]">
              Replicate MongoDB data.
              <br />
              <span className="text-sync-glow">Keep every secret local.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-fog">
              MongoSync copies and exports collections between your environments. The
              browser is only the control panel: reads, writes, encryption and jobs all
              run in a server process on your own machine.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink
                href="/unlock"
                variant="glow"
                size="lg"
              >
                Get started
                <IconArrowRight />
              </ButtonLink>
              <ButtonLink
                href="#manual"
                size="lg"
                variant="outline-dark"
              >
                Read the manual
              </ButtonLink>
            </div>
          </div>

          <HeroVisual />
        </section>
      </div>

      {/* Proof strip */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-line md:grid-cols-4">
          {[
            ["100%", "Local data ownership"],
            ["AES-256", "Encrypted saved URLs"],
            ["500", "Docs per streamed batch"],
            ["10 days", "Job log retention"],
          ].map(([value, label]) => (
            <div key={label} className="bg-surface px-6 py-6">
              <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                {value}
              </p>
              <p className="mt-1 text-[13px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <main>
        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-24">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps from prod to a safe copy."
            description="No cloud account, no hosted service. Everything happens between your machine and the MongoDB servers you choose."
          />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-sync-glow">
                    {step.icon}
                  </span>
                  <span className="font-display text-sm font-medium text-line-strong">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-8 border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-6 py-24">
            <SectionHeading
              eyebrow="Built for safety"
              title="Guard rails for copying real data."
              description="Copying from production should feel boring. These are the parts that keep it that way."
            />
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sync-wash text-sync">
                    {feature.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Manual */}
        <section id="manual" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-24">
          <SectionHeading
            eyebrow="Manual"
            title="Where things live and how to reset."
            description="The full picture of what MongoSync stores, where, and what happens if you lose the master password."
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <ManualCard icon={<IconFolder size={18} />} title="Where your data is stored">
              <p>Everything lives in one folder in your Windows app data:</p>
              <pre className="mt-3 overflow-auto rounded-xl bg-ink px-4 py-3 font-mono text-[13px] text-sync-mist">
                %APPDATA%\MongoSyncLocal
              </pre>
              <ol className="mt-4 grid gap-2">
                {[
                  <>
                    Press <Kbd>Win</Kbd> + <Kbd>R</Kbd>
                  </>,
                  <>
                    Type <Kbd>%APPDATA%</Kbd> and press <Kbd>Enter</Kbd>
                  </>,
                  <>
                    Open the <Kbd>MongoSyncLocal</Kbd> folder
                  </>,
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sync-wash font-display text-[11px] font-semibold text-sync">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4">
                Inside you&apos;ll find <code className="font-mono text-[13px]">config.json</code>,
                session key material, and the <code className="font-mono text-[13px]">jobs</code>{" "}
                folder with snapshots and logs.
              </p>
            </ManualCard>

            <div className="grid gap-4">
              <ManualCard icon={<IconKey size={18} />} title="Authentication and encryption">
                <ul className="grid gap-2">
                  <Bullet>You create a master password on first launch; only its hash is stored.</Bullet>
                  <Bullet>MongoDB connection strings are encrypted before they&apos;re saved.</Bullet>
                  <Bullet>
                    Changing the password from the workspace re-encrypts every saved connection.
                  </Bullet>
                  <Bullet>
                    An optional recovery question can reset the master password without deleting
                    connections.
                  </Bullet>
                </ul>
              </ManualCard>
              <ManualCard icon={<IconTerminal size={18} />} title="Copy processing">
                <ul className="grid gap-2">
                  <Bullet>The frontend never connects to MongoDB directly.</Bullet>
                  <Bullet>Jobs run in the local Node process using the official MongoDB driver.</Bullet>
                  <Bullet>Data moves in streamed batches, so large collections are safe.</Bullet>
                </ul>
              </ManualCard>
            </div>

            <ManualCard icon={<IconRefresh size={18} />} title="Manual delete and reset">
              <p>
                To hard-reset everything, delete the{" "}
                <code className="font-mono text-[13px]">MongoSyncLocal</code> folder, or use{" "}
                <strong className="font-semibold text-ink">Reset all data</strong> on the unlock
                screen.
              </p>
              <p className="mt-3">
                Either way removes saved organizations, connections, job snapshots and logs, and
                the current auth state.
              </p>
            </ManualCard>

            <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/60 p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <IconAlert size={18} />
                </span>
                <h3 className="font-display text-lg font-semibold text-red-800">
                  If you forget your password
                </h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-red-900/80">
                If you set a recovery question, you can answer it on the unlock screen to choose a
                new master password without deleting saved connections. Without recovery, the only
                option is to reset all local data and set up again — encrypted connection strings
                can&apos;t be decrypted without the password or a correct recovery answer.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-14 text-center sm:px-14">
            <div className="bg-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
            <div className="relative flex flex-col items-center">
              <LogoMark tone="dark" size={56} />
              <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em] text-paper sm:text-4xl">
                Ready to make a copy?
              </h2>
              <p className="mt-3 max-w-md text-[15px] text-fog">
                Unlock the app, add your first connection, and run a copy in under a minute.
              </p>
              <ButtonLink
                href="/unlock"
                size="lg"
                variant="glow"
                className="mt-8"
              >
                Open MongoSync
                <IconArrowRight />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Logo size="sm" />
          <p className="text-[13px] text-subtle">
            Local-first MongoDB copy utility. Your data stays on your machine.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-sync">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-muted">{description}</p>
    </div>
  );
}

function ManualCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sync-wash text-sync">
          {icon}
        </span>
        <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h3>
      </div>
      <div className="mt-4 text-sm leading-6 text-muted">{children}</div>
    </article>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sync" />
      <span>{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[12px] text-ink shadow-[0_1px_0_var(--color-line)]">
      {children}
    </kbd>
  );
}

/** Illustrative mock of a running copy job. */
function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-sync-glow/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-ink-3/90 shadow-[0_40px_80px_-24px_rgb(0_0_0/0.6)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sync-glow/10 px-2.5 py-1 text-[11px] font-medium text-sync-glow">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sync-glow opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-sync-glow" />
            </span>
            Running
          </span>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Endpoint label="Source" name="prod-cluster" db="shop" tone="prod" />
            <span className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sync-glow">
              <IconArrowRight />
            </span>
            <Endpoint label="Target" name="staging" db="shop_copy" tone="copy" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {["orders", "customers", "products", "inventory"].map((name) => (
              <span
                key={name}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-fog"
              >
                {name}
              </span>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between text-[12px]">
              <span className="text-fog">
                <span className="font-display text-base font-semibold text-paper">184,500</span> of
                276,912 docs
              </span>
              <span className="font-mono text-sync-glow">67%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="progress-stripes h-full w-2/3 animate-stripes rounded-full bg-sync-glow" />
            </div>
          </div>

          <div className="rounded-xl bg-black/30 p-4 font-mono text-[11.5px] leading-[1.7]">
            <p className="text-fog/70">
              <span className="text-white/30">14:02:11</span>{" "}
              <span className="text-sync-glow">INFO</span> orders → 120,000 copied
            </p>
            <p className="text-fog/70">
              <span className="text-white/30">14:02:14</span>{" "}
              <span className="text-sync-glow">INFO</span> customers → 48,200 copied
            </p>
            <p className="text-fog">
              <span className="text-white/30">14:02:15</span>{" "}
              <span className="text-sync-glow">INFO</span> products → batch 33 of 56
              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-sync-glow" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Endpoint({
  label,
  name,
  db,
  tone,
}: {
  label: string;
  name: string;
  db: string;
  tone: "prod" | "copy";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-fog/70">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={
            tone === "prod"
              ? "flex size-7 items-center justify-center rounded-lg bg-paper text-ink"
              : "flex size-7 items-center justify-center rounded-lg bg-sync-glow text-ink"
          }
        >
          <IconDatabase size={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-paper">{name}</p>
          <p className="truncate font-mono text-[11px] text-fog/70">{db}</p>
        </div>
      </div>
    </div>
  );
}
