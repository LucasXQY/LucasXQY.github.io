import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { projectSchema } from './schemas';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) => projectSchema(image),
});

export const collections = { projects };
