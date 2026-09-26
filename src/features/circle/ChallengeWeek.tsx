import { HeatGrid } from '../../design/components';
import { ME, type ChallengePhoto } from '../../domain/types';
import { useLocale, useStrings } from '../../i18n';
import { photoDayText } from './challengePhotos';
import { thumbUriOf } from './photoUri';

type ChallengeWeekProps = {
  /** One flag per day, Monday first: whether that day was marked. */
  days: readonly boolean[];
  /** The day that is today, 0 for Monday; null when the week shown is not the current one. */
  todayIndex: number | null;
  /** One letter per column, drawn above the row. Left out where the line already says it. */
  labels?: readonly string[];
  /** 'lg' is your week on the challenge's page, big enough to hold the photos (ADR-0051). */
  size?: 'sm' | 'md' | 'lg';
  /** 'md' puts the small squares on the home grid's columns, for the row under it. */
  pitch?: 'own' | 'md';
  onPress?: () => void;
  accessibilityLabel?: string;
  /**
   * One per day, Monday first: the photo pinned to that day, only where the day is
   * marked (`weekPhotos`). A day with one draws its thumbnail, quiet, inside the square.
   */
  photos?: readonly (ChallengePhoto | null)[];
  /** Opens a photo (`circle/photo`): the squares holding one become buttons. */
  onOpenPhoto?: (id: string) => void;
  /** Whose week it is, for VoiceOver on someone else's photos. */
  ownerName?: string;
};

/**
 * A challenge week drawn the way Focus draws its four: ink for a day delivered, an
 * outline for one that is not, today breathing (ADR-0031). It is the same grammar on
 * purpose — a challenge is a week of yours, like the week of focus above it.
 *
 * With photos (ADR-0051), a marked day that has one shows it in its square and opens
 * it. The grid never says where a photo came from, and a day without one looks exactly
 * like it did: a mark is a mark.
 */
export function ChallengeWeek({
  days,
  todayIndex,
  labels,
  size = 'sm',
  pitch = 'own',
  onPress,
  accessibilityLabel,
  photos,
  onOpenPhoto,
  ownerName,
}: ChallengeWeekProps) {
  const t = useStrings().photos;
  const { tag } = useLocale();

  return (
    <HeatGrid
      cells={days.map((done, index) => {
        const photo = done ? (photos?.[index] ?? null) : null;
        if (photo === null) {
          return { key: String(index), intensity: done ? 1 : 0, today: index === todayIndex };
        }
        const day = photoDayText(photo.dayKey, tag, t);
        return {
          key: String(index),
          intensity: 1,
          today: index === todayIndex,
          image: thumbUriOf(photo),
          onPress: onOpenPhoto === undefined ? undefined : () => onOpenPhoto(photo.id),
          accessibilityLabel:
            photo.memberId === ME ? t.viewer.mineA11y(day) : t.viewer.theirsA11y(ownerName ?? '', day),
        };
      })}
      columnLabels={labels}
      size={size}
      pitch={pitch}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
