import { useRouter } from 'expo-router';
import { Alert, Linking } from 'react-native';

import {
  Button,
  ExplainerBlock,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Stack,
  StatusNote,
  Text,
} from '../../design/components';
import { acceptPhotoTerms } from '../../features/circle/photoSharing';
import { useLocale, useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';

/**
 * The terms live on the web (ADR-0046), the same page Acerca de and the welcome open,
 * here straight at the section on photos, in the app's language (`web/legal.js` reads
 * `?lang=`; the anchors are `#fotos` and `#photos`).
 */
const TERMS_URL = 'https://vesper-azure.vercel.app/terms';
const PHOTOS_SECTION = { es: '?lang=es#fotos', en: '?lang=en#photos' } as const;

/**
 * Before the first photo that leaves the phone (ADR-0051 §19): who sees it, how long it
 * stays, what to mind, the one rule with no exceptions and the terms, in the shape of a
 * permission page. It only appears when the photo will be shared — a challenge with
 * photos and somebody else who will see it; a photo that stays on the phone never
 * brings it up — and only until it is accepted once.
 *
 * "Entendido" keeps the acceptance and goes back, and the challenge's page opens the
 * sheet to take or pick the photo (it knows it sent the user here). "Ahora no" goes back
 * and nothing opens. Nothing here is demanded: the mark counts the same without a photo.
 */
export default function PhotoTermsScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.photos.terms;
  const { locale } = useLocale();

  const back = () => goBack(router, BACK_FALLBACK.circle);

  const accept = () => {
    acceptPhotoTerms(Date.now());
    back();
  };

  /** A phone with no browser is rare and not a crash: say it, like Acerca de does. */
  const openTerms = () => {
    Linking.openURL(`${TERMS_URL}${PHOTOS_SECTION[locale]}`).catch(() => {
      Alert.alert(strings.settings.about.linkFailed);
    });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.accept} onPress={accept} />
          <Button label={t.notNow} variant="ghost" onPress={back} />
        </>
      }
    >
      <PageHeader onBack={back} />
      <Text variant="title">{t.title}</Text>
      <Stack gap="xxl">
        <ExplainerBlock icon="users" heading={t.who.heading} body={t.who.body} />
        <ExplainerBlock icon="clock" heading={t.howLong.heading} body={t.howLong.body} />
        <ExplainerBlock icon="user-check" heading={t.care.heading} body={t.care.body} />
      </Stack>
      <StatusNote text={t.zeroTolerance} icon="shield" />
      <ListGroup footer={t.termsNote}>
        <ListRow icon="file-text" label={t.termsRow} onPress={openTerms} />
      </ListGroup>
    </Screen>
  );
}
