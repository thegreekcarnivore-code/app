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
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { getEmailLogoUrl } from '../app-config.ts'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
  language?: string
}

const COPY = {
  en: {
    preview: 'Confirm your email change for The Greek Carnivore',
    heading: 'Confirm email change',
    body1: 'You requested to change your email from',
    body2: 'to',
    body3: 'Click below to confirm this change:',
    button: 'Confirm Email Change',
    footer: "If you didn't request this change, please secure your account immediately.",
  },
  el: {
    preview: 'Επιβεβαιωστε την αλλαγη email για το The Greek Carnivore',
    heading: 'Επιβεβαιωση αλλαγης email',
    body1: 'Ζητησατε αλλαγη του email σας απο',
    body2: 'σε',
    body3: 'Πατηστε παρακατω για να επιβεβαιωσετε:',
    button: 'Επιβεβαιωση Αλλαγης Email',
    footer: 'Αν δεν ζητησατε αυτην την αλλαγη, ασφαλιστε τον λογαριασμο σας αμεσως.',
  },
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
  language = 'en',
}: EmailChangeEmailProps) => {
  const t = COPY[language as keyof typeof COPY] || COPY.en
  const lang = language === 'el' ? 'el' : 'en'
  const logoUrl = getEmailLogoUrl()

  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={logoUrl}
            alt="The Greek Carnivore"
            width="80"
            style={logo}
          />
          <Heading style={h1}>{t.heading}</Heading>
          <Text style={text}>
            {t.body1}{' '}
            <Link href={`mailto:${email}`} style={linkStyle}>{email}</Link>{' '}
            {t.body2}{' '}
            <Link href={`mailto:${newEmail}`} style={linkStyle}>{newEmail}</Link>.
          </Text>
          <Text style={text}>{t.body3}</Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailChangeEmail

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
const linkStyle = { color: '#1a1a1a', textDecoration: 'underline' }
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
