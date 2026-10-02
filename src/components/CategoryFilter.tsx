import { CATEGORIES } from "../lib/categories.ts";
import type { Category } from "../lib/types.ts";

type Props = {
  hidden: Set<Category>;
  onToggle: (category: Category) => void;
};

/** Legend that doubles as a filter. */
export function CategoryFilter({ hidden, onToggle }: Props) {
  return (
    <div className="filters" role="group" aria-label="Show categories">
      {CATEGORIES.map((c) => {
        const on = !hidden.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`chip${on ? "" : " is-off"}`}
            aria-pressed={on}
            title={c.description}
            onClick={() => onToggle(c.id)}
          >
            <span className={`swatch cat-${c.id}`} aria-hidden="true" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
