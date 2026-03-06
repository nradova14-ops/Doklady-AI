"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  function validateFile(f: File): string | null {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return "Nepodporovaný formát. Nahrajte PDF, JPG nebo PNG.";
    }
    if (f.size > MAX_FILE_SIZE) {
      return "Soubor je příliš velký. Maximum je 10 MB.";
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chyba při nahrávání.");
      }

      // Start extraction in background
      fetch(`/api/documents/${data.document_id}/extract`, {
        method: "POST",
      }).catch(console.error);

      router.push(`/documents/${data.document_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala neočekávaná chyba.");
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-800">
            Doklady AI
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            ← Zpět na přehled
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-8 text-center">
          Nahrát doklad
        </h2>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-slate-400 bg-slate-100"
              : file
              ? "border-green-300 bg-green-50"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          {file ? (
            <div>
              <div className="text-3xl mb-2">✓</div>
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="mt-3 text-xs text-red-600 hover:underline"
              >
                Odebrat
              </button>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-3 text-slate-400">📁</div>
              <p className="text-sm font-medium text-slate-700">
                Přetáhněte soubor sem
              </p>
              <p className="text-xs text-slate-500 mt-1">
                nebo klikněte pro výběr (PDF, JPG, PNG — max 10 MB)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>

        {/* Camera button for mobile */}
        <div className="mt-4 sm:hidden">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            📷 Vyfotit doklad
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-6 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Nahrávání...
            </span>
          ) : (
            "Nahrát a vytěžit"
          )}
        </button>
      </main>
    </div>
  );
}
