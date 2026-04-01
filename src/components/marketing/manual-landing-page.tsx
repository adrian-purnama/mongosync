"use client";

import Image from "next/image";
import Link from "next/link";

export function ManualLandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-white via-zinc-50 to-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/logo only.png"
              alt="MongoSync logo"
              width={72}
              height={72}
              className="w-20 shrink-0 object-contain"
            />
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Local-first Mongo utility
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/unlock"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100"
            >
              Unlock app
            </Link>
            <Link
              href="/workspace"
              className="rounded-md border border-zinc-300 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Open
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-r from-zinc-100 via-transparent to-emerald-50" />
          <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
          <Image
              src="/assets/name only.png"
              alt=""
              width={240}
              height={240}
              className="w-60 object-contain"
              aria-hidden="true"
            />
            <p className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-600">
              How this app works
            </p>
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
              Copy MongoDB collections locally, with everything stored on your own
              machine.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-zinc-600">
              MongoSync is a local-first tool. The browser UI is the control panel. The
              actual MongoDB reads, writes, encryption, and copy jobs run in the local
              server process on your machine.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/unlock"
                className="rounded-md border border-zinc-300 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Start using the app
              </Link>
              <a
                href="#manual"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Read manual
              </a>
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-2xl font-semibold text-zinc-950">100%</p>
                <p className="mt-1 text-sm text-zinc-600">Local data ownership</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-2xl font-semibold text-zinc-950">AES</p>
                <p className="mt-1 text-sm text-zinc-600">Encrypted saved URLs</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-2xl font-semibold text-zinc-950">%APPDATA%</p>
                <p className="mt-1 text-sm text-zinc-600">Predictable storage path</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
              <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  <div className="ml-2 h-2.5 w-24 rounded-full bg-zinc-200" />
                </div>
                <div className="grid gap-3 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="h-3 w-20 rounded-full bg-zinc-300" />
                      <div className="mt-3 h-9 rounded-lg bg-white shadow-sm" />
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="h-3 w-24 rounded-full bg-zinc-300" />
                      <div className="mt-3 h-9 rounded-lg bg-white shadow-sm" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="mb-2 h-3 w-28 rounded-full bg-emerald-300" />
                    <div className="h-2.5 rounded-full bg-emerald-200">
                      <div className="h-2.5 w-2/3 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold">UI is only the control panel</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                You choose organization, connections, databases, collections, and copy
                mode from the UI. The heavy work runs locally in the backend process.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">
                    C:
                  </div>
                  <div>
                    <div className="h-3 w-28 rounded-full bg-zinc-300" />
                    <div className="mt-2 h-3 w-36 rounded-full bg-zinc-200" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    %APPDATA%\MongoSyncLocal
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    config.json
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    jobs\ snapshots and logs
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold">Data is stored locally</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Password hash, encrypted connection info, and persisted job history are
                stored in your local app data folder.
              </p>
            </div>
          </div>
          </div>
        </section>

        <section id="manual" className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">1. Authentication and encryption</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
              <p>On first launch, you create a master password.</p>
              <p>The master password hash is stored locally.</p>
              <p>MongoDB connection strings are encrypted before save.</p>
              <p>
                If you are unlocked, you can change your password in workspace and the
                app will re-encrypt saved connection strings.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">2. Copy processing</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
              <p>The frontend never connects directly to MongoDB.</p>
              <p>
                Copy jobs run in the local Node process using MongoDB driver on your
                machine.
              </p>
              <p>
                Data is copied in batches/streams, so large collections are handled
                safely.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">3. Where data is stored (Windows)</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
              <p>Folder:</p>
              <pre className="overflow-auto rounded-lg bg-zinc-950 px-4 py-3 text-sm text-zinc-100">
%APPDATA%\MongoSyncLocal
              </pre>
              <p>How to open it:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Press <code>Win + R</code></li>
                <li>Type <code>%APPDATA%</code></li>
                <li>Open folder <code>MongoSyncLocal</code></li>
              </ol>
              <p>
                You can find local config, auth/session key material, and persisted job
                data there.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">4. Manual delete and reset</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
              <p>
                You can manually delete the <code>MongoSyncLocal</code> folder to hard
                reset everything.
              </p>
              <p>
                You can also use <code>Reset all data</code> from the unlock screen.
              </p>
              <p>
                This deletes saved organizations, saved connections, job snapshots/logs,
                and current app auth state.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="text-xl font-semibold text-red-700">
              5. Forgot password warning
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-700">
              <p>
                If you forget your master password and are fully locked out, there is no
                recovery for your saved encrypted MongoDB connection strings.
              </p>
              <p>
                In plain words: you are effectively stuck for old encrypted secrets and
                must reset all local data, then set up again.
              </p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
