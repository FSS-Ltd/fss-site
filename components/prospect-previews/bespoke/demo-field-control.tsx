export type DemoField =
  | {
      id: string;
      label: string;
      type: "text" | "email" | "tel" | "date" | "postcode" | "registration";
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      type: "select";
      options: readonly string[];
    }
  | {
      id: string;
      label: string;
      type: "textarea";
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      type: "file";
      accept?: string;
    };

export function DemoFieldControl({
  field,
  prominent,
}: {
  field: DemoField;
  prominent: boolean;
}) {
  const wrapperClass = prominent ? "sm:col-span-2" : undefined;
  const controlClass = [
    "mt-2 min-h-12 w-full rounded-2xl border border-current/15 bg-white/80 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-current focus:ring-2 focus:ring-current/15",
    field.type === "registration"
      ? "font-mono text-xl font-black uppercase tracking-[0.14em]"
      : "",
  ].join(" ");

  if (field.type === "select") {
    return (
      <label className={wrapperClass}>
        <span className="text-sm font-bold">{field.label}</span>
        <select
          className={controlClass}
          defaultValue=""
          name={field.id}
          required
        >
          <option disabled value="">
            Choose one
          </option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className={wrapperClass}>
        <span className="text-sm font-bold">{field.label}</span>
        <textarea
          className={`${controlClass} min-h-28 resize-y`}
          name={field.id}
          placeholder={field.placeholder}
          required
        />
      </label>
    );
  }

  if (field.type === "file") {
    return (
      <label className={wrapperClass}>
        <span className="text-sm font-bold">{field.label}</span>
        <input
          accept={field.accept}
          className={`${controlClass} file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-bold`}
          name={field.id}
          type="file"
        />
      </label>
    );
  }

  const inputType =
    field.type === "postcode" || field.type === "registration"
      ? "text"
      : field.type;
  return (
    <label className={wrapperClass}>
      <span className="text-sm font-bold">{field.label}</span>
      <input
        autoCapitalize={
          field.type === "registration" ? "characters" : undefined
        }
        className={controlClass}
        name={field.id}
        placeholder={field.placeholder}
        required
        type={inputType}
      />
    </label>
  );
}
