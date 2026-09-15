import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Icon, ListGroup, ListRow, PageHeader, Screen, Text } from '../../design/components';

type Faq = {
  question: string;
  answer: string;
};

const FAQS: Faq[] = [
  {
    question: '¿Qué es un modo?',
    answer:
      'Un conjunto de apps y sitios que se bloquean (o los únicos que se permiten) mientras enfocás. Cada sesión corre un modo.',
  },
  {
    question: '¿Qué pasa si cierro la app durante una sesión?',
    answer:
      'La sesión sigue. Al volver, el timer está donde lo dejaste. En modo firme o profundo, cerrar la app no la termina.',
  },
  {
    question: '¿Por qué no se suman las tres monedas?',
    answer:
      'Lo verificado (Salud), lo declarado (vos) y lo estimado (uso del teléfono) miden cosas distintas. Sumarlos daría un número que no significa nada.',
  },
  {
    question: '¿Cómo funciona el desbloqueo de emergencia?',
    answer:
      'Termina la sesión en el acto, sin espera. Tenés cinco por mes y se cuentan en Ajustes.',
  },
  {
    question: '¿Vesper sube mis datos?',
    answer: 'No. No hay cuenta ni servidor. Todo vive en este teléfono.',
  },
];

/** Centro de ayuda: five questions; tapping one opens its answer under it. */
export default function HelpScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title="Centro de ayuda" />

      <ListGroup title="preguntas frecuentes">
        {FAQS.map((faq, index) => {
          const open = openIndex === index;
          return (
            <ListRow
              key={faq.question}
              label={faq.question}
              description={open ? faq.answer : undefined}
              right={<Icon name={open ? 'chevron-up' : 'chevron-down'} size="sm" tone="secondary" />}
              onPress={() => setOpenIndex(open ? null : index)}
            />
          );
        })}
      </ListGroup>

      <Text variant="caption" tone="tertiary" align="center">
        ¿Otra cosa? En el prototipo no hay a quién escribirle todavía.
      </Text>
    </Screen>
  );
}
