"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OwnerService } from "@/features/owner/owner.service";
import { KycImageUpload } from "./KycImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const KycForm = ({ defaultValues }: { defaultValues?: any }) => {
  const [documentType, setDocumentType] = useState(defaultValues?.documentType ?? "NATIONAL_ID");
  const [documentNumber, setDocumentNumber] = useState(defaultValues?.documentNumber ?? "");
  const [files, setFiles] = useState<{ documentFront?: File; documentBack?: File; faceImage?: File }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!documentNumber.trim()) {
      toast.error("Enter the identity document number");
      return;
    }
    if (!files.documentFront || !files.documentBack || !files.faceImage) {
      toast.error("Upload the document front, document back, and a face photo");
      return;
    }

    setLoading(true);
    try {
      await OwnerService.submitKyc({ documentType, documentNumber: documentNumber.trim() }, files);
      setSubmitted(true);
      toast.success("Identity verification submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not submit verification documents");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><CheckCircle2 className="h-7 w-7" /></div>
        <h3 className="mt-4 text-lg font-semibold">Submission received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">The review team can now evaluate the identity evidence. Refresh the page later to see the latest status.</p>
        <Button variant="outline" className="mt-5" onClick={() => window.location.reload()}>Refresh verification status</Button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Document type</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NATIONAL_ID">National identity card</SelectItem>
              <SelectItem value="CCCD">Vietnamese citizen ID</SelectItem>
              <SelectItem value="PASSPORT">Passport</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-number">Document number</Label>
          <Input id="document-number" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Identity document number" disabled={loading} />
        </div>
      </div>

      <div className="space-y-3">
        <div><div className="text-sm font-medium">Identity evidence</div><p className="mt-1 text-sm text-muted-foreground">Use clear, uncropped images with readable document details.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <KycImageUpload label="Document front" initialPreview={defaultValues?.documentFrontUrl} onChange={(file) => setFiles((current) => ({ ...current, documentFront: file ?? undefined }))} />
          <KycImageUpload label="Document back" initialPreview={defaultValues?.documentBackUrl} onChange={(file) => setFiles((current) => ({ ...current, documentBack: file ?? undefined }))} />
          <KycImageUpload label="Face photo" initialPreview={defaultValues?.faceImageUrl} onChange={(file) => setFiles((current) => ({ ...current, faceImage: file ?? undefined }))} />
        </div>
      </div>

      <Button onClick={submit} disabled={loading} className="w-full sm:w-auto">
        {loading ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        {loading ? "Uploading evidence" : "Submit for review"}
      </Button>
    </div>
  );
};
