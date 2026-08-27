import { Check, X } from "lucide-react";
import type { RefObject } from "react";

type DemoSuccessDialogProps = {
  businessName: string;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  successMessage: string;
  successTitle: string;
};

export function DemoSuccessDialog({
  businessName,
  closeButtonRef,
  onClose,
  successMessage,
  successTitle,
}: DemoSuccessDialogProps) {
  return (
    <div
      aria-labelledby="demo-success-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-5 backdrop-blur-md"
      role="dialog"
    >
      <div className="relative w-full max-w-md rounded-[2rem] bg-white p-7 text-slate-950 shadow-2xl sm:p-9">
        <button
          aria-label="Close success message"
          className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-slate-100 transition hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
        <span className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Check aria-hidden="true" className="size-7" />
        </span>
        <h2
          className="mt-6 pr-10 text-2xl font-black tracking-tight"
          id="demo-success-title"
        >
          {successTitle}
        </h2>
        <p className="mt-3 leading-7 text-slate-600">{successMessage}</p>
        <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
          This was a demonstration. Nothing was sent to {businessName} and the
          form is not connected to its live systems.
        </p>
        <button
          className="mt-6 min-h-11 rounded-full bg-slate-950 px-5 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onClose}
          type="button"
        >
          Return to the concept
        </button>
      </div>
    </div>
  );
}
