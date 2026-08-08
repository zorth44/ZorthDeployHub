import { COLOR_PRESETS } from "../lib/api";

export function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PRESETS.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="size-6 rounded-full border border-white/20"
            style={{
              backgroundColor: color,
              outline: selected ? `2px solid ${color}` : undefined,
              outlineOffset: selected ? 2 : undefined,
            }}
            aria-label={`Color ${color}`}
          />
        );
      })}
    </div>
  );
}
