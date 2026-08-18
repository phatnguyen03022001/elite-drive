"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { label: string; initialPreview?: string; onChange: (file: File | null) => void };

export const KycImageUpload = ({ label, initialPreview, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);

  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const selectFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file)); onChange(file); if (inputRef.current) inputRef.current.value = "";
  };

  return <div className="space-y-3 rounded-xl border bg-card p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-dashed bg-muted/30">{preview ? <Image src={preview} alt={label} fill className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image selected</div>}</div><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} /><Button type="button" variant="outline" size="sm" className="w-full" onClick={() => inputRef.current?.click()}>{preview ? <RefreshCw /> : <ImagePlus />}{preview ? "Replace image" : "Choose image"}</Button></div>;
};
