/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { getEmailLogoUrl } from '../app-config.ts'

interface ReauthenticationEmailProps {
  token: string
  language?: string
}

const COPY = {
  en: {
    preview: 'Your verification code for The Greek Carnivore',
    heading: 'Verification code',
    body: 'Use the code below to confirm your identity:',
    footer: "This code will expire shortly. If you didn't request this, you can safely ignore it.",
  },
  el: {
    preview: 'Ο κωδικος επαληθευσης σας για το The Greek Carnivore',
    heading: 'Κωδικος επαληθευσης',
    body: 'Χρησιμοποιηστε τον παρακατω κωδικο για να επιβεβαιωσετε την ταυτοτητα σας:',
    footer: 'Ο κωδικος θα ληξει συντομα. Αν δεν το ζητησατε, μπορειτε να το αγνοησετε.',
  },
}

export const ReauthenticationEmail = ({ token, language = 'en' }: ReauthenticationEmailProps) => {
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
          <Text style={text}>{t.body}</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footerStyle}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: "'SF Mono', 'Fira Code', Courier, monospace",
  fontSize: '28px',
  fontWeight: '700' as const,
  color: '#1a1a1a',
  letterSpacing: '0.15em',
  margin: '0 0 30px',
  padding: '16px 24px',
  backgroundColor: '#f5f0e8',
  borderRadius: '12px',
  display: 'inline-block' as const,
}
const footerStyle = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
