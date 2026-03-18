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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  language?: string
  programName?: string | null
  startDate?: string | null
}

function formatDate(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// Bilingual content
const COPY = {
  en: {
    preview: "You've been invited to join The Greek Carnivore",
    heading: "You've been invited",
    body1: "You've received an exclusive invitation to",
    brandName: "The Greek Carnivore",
    body2: "— a private, AI-powered concierge for elite nutrition and wellness.",
    cta_intro: "Click below to accept your invitation and create your account:",
    button: "Accept Invitation",
    footer: "If you weren't expecting this invitation, you can safely ignore this email.",
    programLabel: "Your program",
    startLabel: "Start date",
    features: [] as string[],
    closing: "",
    tagline: "",
  },
  el: {
    preview: "Η πρόσκλησή σου προς την πραγματική αλλαγή",
    heading: "Καλωσόρισες στο δρόμο της επιτυχίας.",
    body1: "Έχεις λάβει μια αποκλειστική πρόσκληση για την εφαρμογή",
    brandName: "The Greek Carnivore",
    body2: ", τον ιδιωτικό χώρο καθοδήγησης που θα σε βοηθήσει να χάσεις βάρος, δυναμώσεις και αποκτήσεις τον απόλυτο έλεγχο της υγείας σου.",
    cta_intro: "Πάτησε παρακάτω για να αποδεχτείς την πρόσκληση και να ξεκινήσεις σήμερα το ταξίδι σου",
    button: "Αποδοχή Πρόσκλησης",
    footer: "",
    programLabel: "Το πρόγραμμά σου",
    startLabel: "Ημ. έναρξης",
    features: [
      "Συστηματική καθοδήγηση προσαρμοσμένη στους στόχους σου",
      "Εργαλεία που ενισχύουν τη συνέπεια και τη συγκέντρωσή σου",
      "Υποστήριξη που σε κρατά στην πορεία σου προς την αλλαγή",
    ],
    closing: "Καλωσόρισες στο The Greek Carnivore.",
    tagline: "Δυνατό σώμα. Καθαρό μυαλό. Μόνιμα αποτελέσματα.",
  },
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
  language,
  programName,
  startDate,
}: InviteEmailProps) => {
  const lang = language === 'el' ? 'el' : 'en'
  const c = COPY[lang] || COPY.en
  const logoUrl = getEmailLogoUrl()

  return (
    <Html lang={lang === 'el' ? 'el' : 'en'} dir="ltr">
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={logoUrl}
            alt="The Greek Carnivore"
            width="80"
            style={logo}
          />
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>
            {c.body1}{' '}
            <Link href={siteUrl} style={link}>
              <strong>{c.brandName}</strong>
            </Link>
            {c.body2}
          </Text>

          {c.features && c.features.length > 0 && (
            <div style={featuresBlock}>
              <Text style={featuresIntroText}>
                {lang === 'el' ? 'Μέσα στο πρόγραμμα θα βρεις:' : 'Inside the program you\'ll find:'}
              </Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                {c.features.map((feat: string, i: number) => (
                  <tr key={i}>
                    <td style={checkmarkTd}>✓</td>
                    <td style={featureTextTd}>{feat}</td>
                  </tr>
                ))}
              </table>
            </div>
          )}

          {programName && (
            <div style={programBox}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <tr>
                  <td style={programLabelTd}>{c.programLabel}</td>
                  <td style={programValueTd}>{programName}</td>
                </tr>
                {startDate && (
                  <tr>
                    <td style={programLabelTd}>{c.startLabel}</td>
                    <td style={programValueTd}>{formatDate(startDate, lang)}</td>
                  </tr>
                )}
              </table>
            </div>
          )}

          <Text style={text}>{c.cta_intro}</Text>
          <Button style={button} href={confirmationUrl}>
            {c.button}
          </Button>

          {c.closing && (
            <Text style={closingStyle}>{c.closing}</Text>
          )}
          {c.tagline && (
            <Text style={taglineStyle}>{c.tagline}</Text>
          )}

          {c.footer && <Text style={footer}>{c.footer}</Text>}
        </Container>
      </Body>
    </Html>
  )
}

export default InviteEmail

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
const programBox = {
  background: '#faf8f4',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 20px',
}
const programLabelTd = {
  padding: '4px 0',
  fontSize: '12px',
  color: '#888888',
  width: '110px',
}
const programValueTd = {
  padding: '4px 0',
  fontSize: '14px',
  color: '#222222',
  fontWeight: '600' as const,
}
const featuresBlock = {
  margin: '0 0 24px',
}
const featuresIntroText = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#333333',
  margin: '0 0 12px',
  lineHeight: '1.6',
}
const checkmarkTd = {
  color: '#b39a64',
  fontWeight: '700' as const,
  fontSize: '16px',
  width: '24px',
  verticalAlign: 'top' as const,
  padding: '4px 0',
}
const featureTextTd = {
  fontSize: '14px',
  color: '#444444',
  lineHeight: '1.5',
  padding: '4px 0',
}
const closingStyle = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1a1a1a',
  margin: '32px 0 4px',
  lineHeight: '1.6',
}
const taglineStyle = {
  fontSize: '13px',
  color: '#b39a64',
  fontStyle: 'italic' as const,
  margin: '0 0 20px',
  letterSpacing: '0.03em',
  lineHeight: '1.5',
}
