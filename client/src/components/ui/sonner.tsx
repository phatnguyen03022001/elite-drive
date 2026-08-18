"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const defaultClassNames = {
  toast: "elite-toast",
  title: "elite-toast-title",
  description: "elite-toast-description",
  icon: "elite-toast-icon",
  actionButton: "elite-toast-action",
  cancelButton: "elite-toast-cancel",
  closeButton: "elite-toast-close",
};

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme || "system") as ToasterProps["theme"]}
      position="bottom-right"
      closeButton
      duration={5_500}
      visibleToasts={4}
      gap={10}
      containerAriaLabel="Elite Drive notifications"
      icons={{
        success: <CircleCheckIcon aria-hidden="true" className="size-5" />,
        info: <InfoIcon aria-hidden="true" className="size-5" />,
        warning: <TriangleAlertIcon aria-hidden="true" className="size-5" />,
        error: <OctagonXIcon aria-hidden="true" className="size-5" />,
        loading: <Loader2Icon aria-hidden="true" className="size-5 animate-spin" />,
      }}
      toastOptions={{
        ...toastOptions,
        closeButtonAriaLabel: toastOptions?.closeButtonAriaLabel || "Dismiss notification",
        classNames: {
          ...defaultClassNames,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
