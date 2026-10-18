import { z } from 'zod';

const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);

export const pubStatus = z.enum([
  'published',
  'accepted',
  'preprint',
  'under-review',
  'in-preparation',
]);

export const publicationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  authors: z.array(z.string()).min(1),
  venue: z.string(),
  year: z.number().int(),
  status: pubStatus,
  type: z.enum(['journal', 'conference', 'preprint']),
  selected: z.boolean().default(false),
  teaser: z.string().optional(),
  links: z
    .object({
      pdf: z.url(),
      arxiv: z.url(),
      code: z.url(),
      project: z.string(),
      doi: z.url(),
    })
    .partial()
    .default({}),
  bibtex: z.string().optional(),
  note: z.string().optional(),
});

export const profileSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  bio: z.array(z.string()).min(1).max(3),
  affiliation: z.string(),
  priorDegree: z.string().optional(),
  status: z.string(),
  email: z.email(),
  headshot: z.string().optional(),
  links: z
    .object({
      github: z.url(),
      linkedin: z.url(),
      researchgate: z.url(),
      scholar: z.url(),
      orcid: z.url(),
    })
    .partial()
    .default({}),
});

export const newsSchema = z.array(
  z.object({
    date: yearMonth,
    text: z.string(),
    link: z.string().optional(),
  }),
);

const entry = z.object({
  title: z.string(),
  org: z.string(),
  role: z.string().optional(),
  location: z.string().optional(),
  dates: z.string(),
  bullets: z.array(z.string()),
});

export const cvSchema = z.object({
  education: z.array(entry),
  research: z.array(entry),
  teaching: z.array(entry),
  industry: z.array(entry),
  leadership: z.array(entry),
  honors: z.array(z.object({ title: z.string(), date: z.string() })),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
});

// In zod 4 `.default(v)` returns `v` as-is without parsing it, so nested defaults would be
// skipped. `games` and `music` contain defaulted arrays, so they use `.prefault({})`, which
// parses `{}` through the schema and lets those inner defaults apply.
export const miscSchema = z.object({
  intro: z.string().default(''),
  hobbies: z
    .array(z.object({ title: z.string(), text: z.string(), image: z.string().optional() }))
    .default([]),
  games: z
    .object({
      nowPlaying: z.object({ title: z.string(), platform: z.string() }).optional(),
      list: z
        .array(
          z.object({
            title: z.string(),
            platform: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .default([]),
    })
    .prefault({}),
  music: z
    .object({
      embedUrl: z.url().optional(),
      playlists: z.array(z.object({ title: z.string(), url: z.url() })).default([]),
    })
    .prefault({}),
});

/** `image` is Astro's schema-context helper (`schema: ({ image }) => projectSchema(image)`). */
export const projectSchema = <I extends z.ZodType>(image: () => I) =>
  z.object({
    title: z.string(),
    summary: z.string(),
    cover: image().optional(),
    tags: z.array(z.string()),
    date: yearMonth,
    status: z.enum(['ongoing', 'done']),
    featured: z.boolean().default(false),
    links: z
      .object({
        code: z.url(),
        paper: z.url(),
        demo: z.url(),
      })
      .partial()
      .default({}),
    publication: z.string().optional(),
    // `label` and `alt` describe the pair; without them the page captions it as an illustration,
    // which is what a placeholder pair is.
    enhanceDemo: z
      .object({
        dark: image(),
        bright: image(),
        label: z.string().optional(),
        alt: z.string().optional(),
      })
      .optional(),
  });

export type PubStatus = z.infer<typeof pubStatus>;
export type Publication = z.infer<typeof publicationSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type News = z.infer<typeof newsSchema>;
export type Cv = z.infer<typeof cvSchema>;
export type Misc = z.infer<typeof miscSchema>;
