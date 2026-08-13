import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-card border border-table-border shadow-xl shadow-zinc-200/60 p-8">
          <Image src="/agslogo.png" alt="AGS One" width={64} height={64} unoptimized className="object-contain mx-auto mb-4" />
          <p className="text-zinc-400 text-sm font-semibold tracking-wide">404</p>
          <h1 className="text-xl font-bold text-zinc-900 mt-1">Page not found</h1>
          <p className="text-zinc-500 text-sm mt-2">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center w-full bg-command-black text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
