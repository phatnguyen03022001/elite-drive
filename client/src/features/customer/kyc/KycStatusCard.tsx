"use client";

import { ChangeEvent, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImagePlus, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface KycImageUploadProps {
  label: string;
  initialPreview?: string;
  onChange: (f: File | null) => void;
}

export const KycImageUpload = ({ label, initialPreview, onChange }: KycImageUploadProps) => {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayPreview = localPreview || initialPreview || null;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (localPreview) URL.revokeObjectURL(localPreview);

    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreview(objectUrl);
    onChange(selectedFile);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3 w-full">
      <Label className="text-sm font-semibold">{label}</Label>

      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all hover:border-primary/50 bg-muted/30",
          displayPreview && "border-solid border-muted bg-background",
        )}
      >
        <AspectRatio ratio={16 / 10} className="flex items-center justify-center">
          {displayPreview ? (
            <>
              <Image src={displayPreview} alt={label} fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                <Button variant="secondary" size="sm" type="button" className="h-8 shadow-sm pointer-events-none">
                  <RotateCcw className="mr-2 h-4 w-4" /> Thay đổi
                </Button>
                <Button variant="destructive" size="icon" type="button" className="h-8 w-8 shadow-sm" onClick={handleRemove}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground group-hover:text-primary transition-colors">
              <div className="p-3 rounded-full bg-background border shadow-sm group-hover:border-primary/50">
                <ImagePlus className="h-6 w-6" />
              </div>
              <p className="text-xs font-medium">Nhấp để tải ảnh lên</p>
            </div>
          )}
        </AspectRatio>
      </div>

      <input type="file" ref={inputRef} onChange={handleChange} accept="image/*" className="hidden" />
    </div>
  );
};
