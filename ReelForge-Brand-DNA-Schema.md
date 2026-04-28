# Brand DNA — Per-Client Configuration Schema

The Brand DNA is the JSON object that drives all content generation for a specific client. **It's the only thing that changes between deployments.** The engine code stays universal.

Under the locked operational model, **Brand DNA evolves weekly** based on performance data. Versioning, iteration logs, and analytics baselines are first-class fields, not afterthoughts.

---

## 1. The Schema

```json
{
  "tenant_id": "uuid",
  "brand_name": "string",
  "brand_dna_version": "v1.0",
  "status": "draft | locked | iterating",
  "created_at": "ISO8601",
  "locked_at": "ISO8601 | null",

  "business": {
    "niche": "string",
    "sub_niche": "string",
    "product_or_service": "string",
    "price_point": "string",
    "business_model": "subscription | one-off | high-ticket | course | physical-product"
  },

  "ideal_client": {
    "demographics": {
      "age_range": "string",
      "gender": "string",
      "location": "string",
      "income_level": "string"
    },
    "psychographics": {
      "identity": "string",
      "fears": ["string"],
      "desires": ["string"],
      "objections": ["string"]
    },
    "pain_points": ["string (ranked by emotional weight)"],
    "transformations": ["string (ranked by desirability)"]
  },

  "voice": {
    "tone": "string",
    "formality": "formal | semi-formal | casual | street",
    "perspective": "expert | peer | mentor | challenger | guide",
    "language_primary": "el | en | es | ...",
    "language_secondary": "string | null",
    "signature_phrases": ["string"],
    "forbidden_phrases": ["string"],
    "forbidden_words": ["string"]
  },

  "strategy": {
    "differentiator": "string (the angle/wedge)",
    "credibility_proof": ["string"],
    "primary_cta": "string",
    "secondary_ctas": ["string"],
    "cta_style": "soft | direct | urgent | curiosity-loop"
  },

  "content_rules": {
    "title_max_words": 8,
    "spoken_body_word_count": [105, 145],
    "ctas_per_post": 1,
    "numbers_to_words": true,
    "music_default_on": true,
    "format_specific_rules": {
      "reels_duration_seconds": [45, 50],
      "carousel_slides_default": 1,
      "fading_stars_on_single_slide": true
    },
    "archetype_weights": {
      "pain_point": 0.20,
      "transformation": 0.20,
      "differentiator": 0.20,
      "objection": 0.20,
      "credibility": 0.20
    }
  },

  "visual": {
    "aesthetic": "string",
    "color_palette": ["#hex"],
    "title_style_preset": "string",
    "logo_url": "string | null",
    "watermark_position": "top-left | top-right | bottom-left | bottom-right | center | none"
  },

  "audio": {
    "voice_provider": "elevenlabs | openai-tts",
    "voice_id": "string",
    "voice_gender": "male | female | non-binary",
    "voice_style_prompt": "string",
    "music_genre_preferences": ["string"]
  },

  "scheduling": {
    "posts_per_week": 5,
    "preferred_post_times_local": ["09:00", "19:00"],
    "timezone": "Europe/Athens",
    "platforms": ["instagram", "tiktok", "youtube_shorts"],
    "auto_publish": true
  },

  "references": {
    "loved_accounts": ["@handle"],
    "disliked_accounts": ["@handle"],
    "loved_reels_urls": ["string"],
    "their_own_top_performing_urls": ["string"]
  },

  "compliance": {
    "topics_to_avoid": ["string"],
    "required_disclaimers": ["string"]
  },

  "analytics": {
    "baseline_period_start": "ISO8601",
    "baseline_period_end": "ISO8601",
    "baseline_metrics": {
      "avg_reach_per_reel": 0,
      "avg_plays_per_reel": 0,
      "avg_completion_rate_pct": 0,
      "avg_saves_per_reel": 0,
      "avg_shares_per_reel": 0,
      "avg_comments_per_reel": 0
    },
    "current_period_metrics": {
      "avg_reach_per_reel": 0,
      "avg_plays_per_reel": 0,
      "avg_completion_rate_pct": 0,
      "avg_saves_per_reel": 0,
      "avg_shares_per_reel": 0,
      "avg_comments_per_reel": 0,
      "period_start": "ISO8601",
      "period_end": "ISO8601"
    },
    "trend_direction": "improving | flat | declining"
  },

  "iteration_log": [
    {
      "version": "v1.1",
      "date": "ISO8601",
      "trigger": "weekly_report | client_request | manual_strategic",
      "winners_reinforced": ["string"],
      "losers_killed": ["string"],
      "fields_changed": ["dot.path.notation"],
      "approved_by_client": true
    }
  ]
}
```

---

## 2. Field-by-Field Guide (the ones that matter most)

These are the fields that make or break content quality. Spend the most Zoom time here.

### `business.sub_niche`
Niche is broad ("pilates"). Sub-niche is narrow ("reformer pilates for women 35-55 with chronic lower-back pain"). The sub-niche is what makes content feel *for them, not generic*. Always push the client to commit to a sub-niche even if their offer is broader — narrower content converts better.

### `ideal_client.psychographics.identity`
Who the ideal client *thinks they are* (or wants to be). The single most important field. Without it, content is bland.

### `ideal_client.pain_points` (ranked)
Not all pain points are equal. Rank them. Reel hooks should target #1 and #2 most often.

### `voice.signature_phrases` and `voice.forbidden_phrases`
Equally important. Memorialize what to say AND what NOT to say. Greek Carnivore example: signature *"είμαι μέσα"* (testimonial), forbidden *"πάτα ακολούθησε"*.

### `strategy.differentiator`
The single sentence answering "why this brand and not another in the same niche?" If they can't articulate it sharply, content will be interchangeable with competitors. **Demand a sharp answer on the Zoom.**

### `strategy.cta_style`
- **Soft:** "If this resonated, save it."
- **Direct:** "Join now, link in bio."
- **Urgent:** "Cohort closes Friday — 3 spots left."
- **Curiosity-loop:** "Comment 'GUIDE' and I'll send you the full version."

Wrong style for the audience tanks engagement.

### `content_rules.archetype_weights`
**This is the field that the weekly evolution loop tunes most often.** Starts at 0.20 each (equal weight). After 4-6 weeks of data, you'll see (e.g.) pain-point hooks outperforming transformation hooks 2:1 — bump pain_point to 0.35, drop transformation to 0.15. Engine biases topic selection accordingly.

### `analytics.baseline_metrics`
Captured during the first 2-3 weeks after v1.0 lock. This is "where they started." Every weekly report compares current vs. baseline so progress is measurable, not vibes.

### `iteration_log`
**Append-only history.** Every Brand DNA change is logged: what version, when, what triggered it, what won, what lost, what fields changed, did the client approve. Becomes the receipt of value at renewal time — concrete proof you're earning the €500/mo.

---

## 3. Worked Example — Maria Pilates Athens (after 6 weeks of evolution)

A Brand DNA at v1.4 — meaning 4 weekly iterations have happened since v1.0 lock. Notice how `archetype_weights` shifted, how `signature_phrases` got refined, and how the iteration log tells the story.

```json
{
  "tenant_id": "tenant_maria_pilates_001",
  "brand_name": "Maria Pilates Athens",
  "brand_dna_version": "v1.4",
  "status": "iterating",
  "created_at": "2026-04-25T10:00:00Z",
  "locked_at": "2026-04-30T15:30:00Z",

  "business": {
    "niche": "Pilates / women's fitness",
    "sub_niche": "Reformer pilates for women 35-55 with chronic lower-back pain",
    "product_or_service": "12-week reformer pilates program (in-studio, Athens)",
    "price_point": "€680 for 12 weeks (12 sessions)",
    "business_model": "Cohort-based, 3 cohorts/year"
  },

  "ideal_client": {
    "demographics": {
      "age_range": "35-55",
      "gender": "female",
      "location": "Athens metro",
      "income_level": "middle to upper-middle"
    },
    "psychographics": {
      "identity": "A woman who used to feel strong and is alarmed by how her back and posture have betrayed her since 40",
      "fears": ["Becoming the woman who can't pick up her grandchildren", "Surgery", "Permanent decline"],
      "desires": ["Effortless posture", "Pain-free mornings", "Feeling strong in her body again"],
      "objections": ["I tried yoga and it didn't work", "Reformer looks intimidating", "I don't have time"]
    },
    "pain_points": [
      "Lower back pain that flares with desk work and parenting",
      "Tight hips from sitting all day",
      "Loss of core strength after pregnancy years",
      "Fear of injury making her cautious in daily movement"
    ],
    "transformations": [
      "Wake up without back stiffness",
      "Pick up children/grandchildren without bracing",
      "Feel posture re-organize itself within weeks",
      "Move with confidence again"
    ]
  },

  "voice": {
    "tone": "warm-authoritative",
    "formality": "semi-formal",
    "perspective": "mentor",
    "language_primary": "el",
    "language_secondary": "en",
    "signature_phrases": [
      "Το σώμα ξέρει",
      "Δύναμη χωρίς πόνο",
      "Πιο ψηλά, πιο ελαφριά",
      "Η αναπνοή είναι το πρώτο βήμα"
    ],
    "forbidden_phrases": ["no pain no gain", "γυμναστική για τις γυναίκες", "burn fat fast", "tone up"],
    "forbidden_words": ["adelgyse", "fat-burn", "shred", "bikini-body"]
  },

  "strategy": {
    "differentiator": "Athens-based reformer studio specifically for women 35+ with back pain — most studios target young fitness enthusiasts; Maria's clientele is forgotten by the market",
    "credibility_proof": [
      "12 years teaching, 600+ women coached",
      "Featured in Vogue Greece (2024)",
      "Average reported pain reduction: 70% within 6 weeks",
      "85% of clients renew for a second cohort"
    ],
    "primary_cta": "Σχόλιο 'POSTURE' και σου στέλνω τον οδηγό αναπνοής",
    "secondary_ctas": [
      "Κλείσε δωρεάν αξιολόγηση posture (link in bio)",
      "Σώσε για να δείξεις σε μια φίλη που έχει πόνο"
    ],
    "cta_style": "curiosity-loop"
  },

  "content_rules": {
    "title_max_words": 7,
    "spoken_body_word_count": [110, 140],
    "ctas_per_post": 1,
    "numbers_to_words": false,
    "music_default_on": true,
    "format_specific_rules": {
      "reels_duration_seconds": [40, 55],
      "carousel_slides_default": 1,
      "fading_stars_on_single_slide": true
    },
    "archetype_weights": {
      "pain_point": 0.40,
      "transformation": 0.15,
      "differentiator": 0.15,
      "objection": 0.20,
      "credibility": 0.10
    }
  },

  "visual": {
    "aesthetic": "minimalist-clinical-warm",
    "color_palette": ["#F5EFE6", "#3A3A3A", "#C99E72"],
    "title_style_preset": "elegant_serif_white",
    "logo_url": null,
    "watermark_position": "bottom-right"
  },

  "audio": {
    "voice_provider": "elevenlabs",
    "voice_id": "voice_eleni_warm_v2",
    "voice_gender": "female",
    "voice_style_prompt": "warm, calm, gentle authority — like a trusted older sister who happens to be an expert",
    "music_genre_preferences": ["ambient acoustic", "soft piano", "lo-fi instrumental"]
  },

  "scheduling": {
    "posts_per_week": 5,
    "preferred_post_times_local": ["08:00", "20:00"],
    "timezone": "Europe/Athens",
    "platforms": ["instagram"],
    "auto_publish": true
  },

  "references": {
    "loved_accounts": ["@melissawoodhealth", "@pilatesbody.kerry"],
    "disliked_accounts": [],
    "loved_reels_urls": [],
    "their_own_top_performing_urls": []
  },

  "compliance": {
    "topics_to_avoid": [
      "Specific medical claims about herniated discs",
      "Weight-loss promises",
      "Pregnancy-specific exercise advice without disclaimer"
    ],
    "required_disclaimers": ["Δεν αντικαθιστά ιατρική συμβουλή"]
  },

  "analytics": {
    "baseline_period_start": "2026-05-01",
    "baseline_period_end": "2026-05-21",
    "baseline_metrics": {
      "avg_reach_per_reel": 1240,
      "avg_plays_per_reel": 1850,
      "avg_completion_rate_pct": 38,
      "avg_saves_per_reel": 18,
      "avg_shares_per_reel": 4,
      "avg_comments_per_reel": 7
    },
    "current_period_metrics": {
      "avg_reach_per_reel": 2890,
      "avg_plays_per_reel": 4200,
      "avg_completion_rate_pct": 51,
      "avg_saves_per_reel": 47,
      "avg_shares_per_reel": 11,
      "avg_comments_per_reel": 19,
      "period_start": "2026-06-01",
      "period_end": "2026-06-07"
    },
    "trend_direction": "improving"
  },

  "iteration_log": [
    {
      "version": "v1.1",
      "date": "2026-05-11",
      "trigger": "weekly_report",
      "winners_reinforced": [
        "Pain-point #1 (back pain at desk) hooks averaged 2.3x reach vs transformation hooks"
      ],
      "losers_killed": [
        "Direct CTA 'Book a free assessment' had 0.4% click-through; soft CTAs averaging 1.8%"
      ],
      "fields_changed": ["content_rules.archetype_weights", "strategy.cta_style"],
      "approved_by_client": true
    },
    {
      "version": "v1.2",
      "date": "2026-05-18",
      "trigger": "weekly_report",
      "winners_reinforced": [
        "Reels mentioning 'morning stiffness' got 3.1x saves — added to pain_points #1"
      ],
      "losers_killed": [
        "Posts at 19:00 underperformed 08:00 by 40% — adjusted schedule"
      ],
      "fields_changed": ["ideal_client.pain_points", "scheduling.preferred_post_times_local"],
      "approved_by_client": true
    },
    {
      "version": "v1.3",
      "date": "2026-05-25",
      "trigger": "weekly_report",
      "winners_reinforced": [
        "Curiosity-loop CTAs ('Comment POSTURE') outperformed soft CTAs by 4x in saves"
      ],
      "losers_killed": [],
      "fields_changed": ["strategy.cta_style", "strategy.primary_cta"],
      "approved_by_client": true
    },
    {
      "version": "v1.4",
      "date": "2026-06-01",
      "trigger": "weekly_report",
      "winners_reinforced": [
        "Objection-handling reels ('I tried yoga and it didn't work') averaging 4.5x shares — clients tagging friends"
      ],
      "losers_killed": [
        "Credibility-only reels (Vogue mention etc.) bottom 20% of all reels — reduced weight"
      ],
      "fields_changed": ["content_rules.archetype_weights", "voice.signature_phrases"],
      "approved_by_client": true
    }
  ]
}
```

**Read the iteration log top-to-bottom.** That's the story of a Brand DNA learning what works. By v1.4, archetype_weights have shifted dramatically from the v1.0 baseline. Reach has more than doubled. **That progression is what €500/mo buys.**

---

## 4. How Brand DNA Is Used (LLM Prompt Template)

Every LLM call gets prefixed with Brand DNA injection. Example for the **script generation step** (Sonnet 4.6):

```
You are writing a short-form video script for {brand_name}.

BRAND CONTEXT
- Niche: {business.niche}
- Sub-niche: {business.sub_niche}
- What they sell: {business.product_or_service}
- Differentiator: {strategy.differentiator}
- Ideal client identity: {ideal_client.psychographics.identity}

VOICE RULES
- Tone: {voice.tone}, perspective: {voice.perspective}
- Primary language: {voice.language_primary}
- Signature phrases (use 0-1 per reel where natural): {voice.signature_phrases}
- NEVER use these phrases: {voice.forbidden_phrases}
- NEVER use these words: {voice.forbidden_words}

PAIN POINTS (target #1 or #2 in hook):
{ideal_client.pain_points}

TRANSFORMATIONS (the promise):
{ideal_client.transformations}

CREDIBILITY (inject 1 proof per reel, rotate):
{strategy.credibility_proof}

CONTENT RULES
- Title max words: {content_rules.title_max_words}
- Spoken body word count: {content_rules.spoken_body_word_count}
- CTAs per post: exactly {content_rules.ctas_per_post}
- CTA style: {strategy.cta_style}
- Primary CTA: {strategy.primary_cta}
- Numbers-to-words: {content_rules.numbers_to_words}

ARCHETYPE THIS WEEK (selected by topic engine using archetype_weights):
{archetype_for_this_reel}

COMPLIANCE
- Topics to avoid: {compliance.topics_to_avoid}
- If unavoidable, append: {compliance.required_disclaimers}

NOW generate a reel script for the topic: [TOPIC FROM RESEARCH STEP]
Output JSON: { "title": "...", "spoken_body": "...", "cta": "..." }
```

Opus 4.7 grammar-check step gets a similar prompt with `voice.language_primary` and the full forbidden lists to enforce.

---

## 5. Versioning Rules

| Bump type | Trigger | Example |
|---|---|---|
| Patch (v1.0 → v1.0.1) | Tiny tweak | Added one forbidden word |
| **Minor (v1.0 → v1.1)** | **Weekly report iteration** | Shifted archetype_weights, refined a CTA |
| Major (v1.x → v2.0) | Strategic pivot | New sub-niche, new ideal client |

**Every version is stored** in the `brand_dna` table, never overwritten. Lets you:
- Compare which version produced which content with what performance
- Roll back if a v1.x change tanked engagement
- Show the client their evolution over time (excellent at renewal conversations)

---

## 6. The Schema Will Evolve

Your first 3 clients will reveal fields you wish you'd had. Likely additions over time:

- `seasonality` — content rotates differently around holidays/seasons.
- `competitors_to_punch_up_at` — explicit list of named competitors for differentiation content.
- `topic_pillars` — 3-5 recurring themes the topic-research engine biases toward.
- `content_calendar_overrides` — manual injections (product launches, sales, events) that take priority over auto-generated topics.

**Don't add these in v1.** Wait until 2 separate clients hit the same gap, then add. Premature schema bloat is the enemy.
