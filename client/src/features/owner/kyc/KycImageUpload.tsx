"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  initialPreview?: string;
  onChange: (file: File | null) => void;
};

export const KycImageUpload = ({ label, initialPreview, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const selectFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("relative aspect-[3/2] overflow-hidden rounded-lg border border-dashed bg-muted/30", preview ? "border-border" : "border-muted-foreground/30")}>
        {preview ? <Image src={preview} alt={label} fill className="object-cover" unoptimized /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><Camera className="h-6 w-6" /><span className="text-xs">No image selected</span></div>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => inputRef.current?.click()}>
        {preview ? <RefreshCw /> : <ImagePlus />}
        {preview ? "Replace image" : "Choose image"}
      </Button>
    </div>
  );
};
