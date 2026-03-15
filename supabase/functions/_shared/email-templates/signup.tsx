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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  language?: string
}

const COPY = {
  en: {
    preview: 'Welcome to The Greek Carnivore — confirm your email',
    heading: 'Welcome aboard',
    body1: "You've been granted access to",
    brandName: 'The Greek Carnivore',
    body2: '— your private concierge for elite nutrition.',
    confirmLine: 'Confirm your email (',
    confirmEnd: ') to get started:',
    button: 'Confirm Email',
    footer: "If you didn't create an account, you can safely ignore this email.",
  },
  el: {
    preview: 'Καλως ηρθατε στο The Greek Carnivore — επιβεβαιωστε το email σας',
    heading: 'Καλως ηρθατε',
    body1: 'Σας εχει δοθει προσβαση στο',
    brandName: 'The Greek Carnivore',
    body2: '— ο προσωπικος σας συμβουλος διατροφης.',
    confirmLine: 'Επιβεβαιωστε το email σας (',
    confirmEnd: ') για να ξεκινησετε:',
    button: 'Επιβεβαιωση Email',
    footer: 'Αν δεν δημιουργησατε λογαριασμο, μπορειτε να αγνοησετε αυτο το email.',
  },
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  language = 'en',
}: SignupEmailProps) => {
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
          <Text style={text}>
            {t.body1}{' '}
            <Link href={siteUrl} style={link}>
              <strong>{t.brandName}</strong>
            </Link>
            {' '}{t.body2}
          </Text>
          <Text style={text}>
            {t.confirmLine}
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            {t.confirmEnd}
          </Text>
          <Button style={button} href={confirmationUrl}>
            {t.button}
          </Button>
          <Text style={footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default SignupEmail

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
const link = { color: '#1a1a1a', textDecoration: 'underline' }
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
