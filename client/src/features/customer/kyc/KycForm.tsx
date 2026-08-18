"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, SendHorizontal } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { KycImageUpload } from "./KycImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify, notifyError } from "@/lib/notifications";

export const KycForm = ({ defaultValues }: { defaultValues?: any }) => {
  const [documentType, setDocumentType] = useState(defaultValues?.documentType ?? "NATIONAL_ID");
  const [documentNumber, setDocumentNumber] = useState(defaultValues?.documentNumber ?? "");
  const [files, setFiles] = useState<{ documentFront?: File; documentBack?: File; faceImage?: File }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!documentNumber.trim()) {
      notify.warning("Document number required", {
        id: "kyc-validation",
        description: "Enter the number shown on the identity document you are submitting.",
      });
      return;
    }

    if (!files.documentFront || !files.documentBack || !files.faceImage) {
      notify.warning("Three images are required", {
        id: "kyc-validation",
        description: "Upload the document front, document back, and a clear face photo before submitting.",
      });
      return;
    }

    setLoading(true);
    try {
      await CustomerService.submitKyc({ documentType, documentNumber: documentNumber.trim() }, files);
      setSubmitted(true);
      notify.success("Verification submitted", {
        id: "kyc-submit",
        description: "Your identity evidence is now waiting for operations review.",
      });
    } catch (error: unknown) {
      notifyError(
        "Verification could not be submitted",
        error,
        "Your evidence was not saved. Check your connection and try again.",
        { id: "kyc-submit" },
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Submission received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Operations can now review your identity evidence.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => window.location.reload()}>
          Refresh verification status
        </Button>
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
          <Input
            id="document-number"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder="Identity document number"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">Identity evidence</div>
          <p className="mt-1 text-sm text-muted-foreground">Use clear, uncropped images with readable details.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <KycImageUpload
            label="Document front"
            initialPreview={defaultValues?.documentFrontUrl}
            onChange={(file) => setFiles((current) => ({ ...current, documentFront: file ?? undefined }))}
          />
          <KycImageUpload
            label="Document back"
            initialPreview={defaultValues?.documentBackUrl}
            onChange={(file) => setFiles((current) => ({ ...current, documentBack: file ?? undefined }))}
          />
          <KycImageUpload
            label="Face photo"
            initialPreview={defaultValues?.faceImageUrl}
            onChange={(file) => setFiles((current) => ({ ...current, faceImage: file ?? undefined }))}
          />
        </div>
      </div>

      <Button onClick={submit} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        {loading ? "Uploading evidence" : "Submit for review"}
      </Button>
    </div>
  );
};
