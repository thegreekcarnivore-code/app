/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  language?: string
}

const COPY = {
  en: {
    preview: 'Reset your password for The Greek Carnivore',
    heading: 'Reset your password',
    body: 'We received a request to reset your password. Click the button below to choose a new one.',
    button: 'Reset Password',
    footer: "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  },
  el: {
    preview: 'Επαναφορα κωδικου για το The Greek Carnivore',
    heading: 'Επαναφορα κωδικου',
    body: 'Λαβαμε αιτημα επαναφορας του κωδικου σας. Πατηστε το κουμπι παρακατω για να επιλεξετε νεο κωδικο.',
    button: 'Αλλαγη Κωδικου',
    footer: 'Αν δεν ζητησατε επαναφορα κωδικου, μπορειτε να αγνοησετε αυτο το email. Ο κωδικος σας δεν θα αλλαξει.',
  },
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  language = 'en',
}: RecoveryEmailProps) => {
  const t = COPY[language as keyof typeof COPY] || COPY.en
  const lang = language === 'el' ? 'el' : 'en'

  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1"
            alt="The Greek Carnivore"
            width="80"
            style={logo}
          />
          <Heading style={h1}>{t.heading}</Heading>
          <Text style={text}>{t.body}</Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 30px', maxWidth: '480px', margin: '0 auto' }
const logo = { margin: '0 0 24px' }
const h1 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#1a1a1a',
  margin: '0 0 20px',
  letterSpacing: '0.02em',
}
const text = { fontSize: '14px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#b39a64',
  color: '#141414',
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
