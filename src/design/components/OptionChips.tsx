import { Chip } from './Chip';
import { ChipRow } from './ChipRow';

export type ChipOption<T extends string | number> = {
  value: T;
  /** Defaults to String(value). */
  label?: string;
};

type OptionChipsProps<T extends string | number> = {
  options: ReadonlyArray<ChipOption<T>>;
  selected: T | null;
  onSelect: (value: T) => void;
};

/**
 * A row of exclusive options: durations, targets, activities. One selected at most.
 * Exists because four screens were writing the same map over Chip by hand.
 */
export function OptionChips<T extends string | number>({
  options,
  selected,
  onSelect,
}: OptionChipsProps<T>) {
  return (
    <ChipRow>
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label ?? String(option.value)}
          selected={option.value === selected}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </ChipRow>
  );
}
