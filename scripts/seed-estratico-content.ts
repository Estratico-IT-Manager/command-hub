import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateApiKey, hashApiKey, slugify } from "../lib/cms";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

const SITE_NAME = "Estratico Profile";
const SITE_SLUG = "estratico-profile";

// Path to the profile website repo (for legal page markdown)
const PROFILE_REPO = process.env.PROFILE_REPO_PATH ?? "/home/estratico/Projects/internal/estratico-profile";

type FieldDef = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  isTitle?: boolean;
  isSlugSource?: boolean;
  options?: { options?: string[]; fields?: unknown[] };
  relationTypeId?: string;
};

const CONTENT_TYPES: { name: string; label: string; description: string; fields: FieldDef[] }[] = [
  {
    name: "posts",
    label: "Blog Posts",
    description: "Articles published on the blog.",
    fields: [
      { name: "title", label: "Title", type: "TEXT", required: true, isTitle: true },
      { name: "slug", label: "Slug", type: "TEXT" },
      { name: "description", label: "Description", type: "TEXTAREA", required: true },
      { name: "content", label: "Content", type: "MARKDOWN", required: true },
      { name: "author", label: "Author", type: "TEXT" },
      {
        name: "status",
        label: "Status",
        type: "SELECT",
        options: { options: ["published", "draft"] },
      },
      { name: "cover_image", label: "Cover Image", type: "IMAGE" },
      { name: "published_at", label: "Published At", type: "DATETIME" },
    ],
  },
  {
    name: "projects",
    label: "Portfolio Projects",
    description: "Case studies shown on /work.",
    fields: [
      { name: "title", label: "Title", type: "TEXT", required: true, isTitle: true, isSlugSource: true },
      { name: "slug", label: "Slug", type: "TEXT" },
      { name: "client", label: "Client", type: "TEXT" },
      { name: "category", label: "Category", type: "TEXT" },
      { name: "description", label: "Description", type: "TEXTAREA", required: true },
      {
        name: "technologies",
        label: "Technologies",
        type: "REPEATER",
        options: {
          fields: [{ name: "technology", label: "Technology", type: "TEXT", required: true }],
        },
      },
      { name: "image", label: "Image", type: "IMAGE" },
      { name: "featured", label: "Featured", type: "BOOLEAN" },
      { name: "order", label: "Order", type: "NUMBER" },
    ],
  },
  {
    name: "testimonials",
    label: "Testimonials",
    description: "Customer quotes shown on the home page.",
    fields: [
      { name: "quote", label: "Quote", type: "TEXTAREA", required: true },
      { name: "author", label: "Author", type: "TEXT", isTitle: true },
      { name: "role", label: "Role", type: "TEXT" },
      { name: "avatar", label: "Avatar", type: "IMAGE" },
      { name: "order", label: "Order", type: "NUMBER" },
    ],
  },
  {
    name: "faqs",
    label: "FAQs",
    description: "Frequently asked questions.",
    fields: [
      { name: "question", label: "Question", type: "TEXT", required: true, isTitle: true },
      { name: "answer", label: "Answer", type: "MARKDOWN", required: true },
    ],
  },
  {
    name: "stats",
    label: "Stats",
    description: "Headline numbers shown on the home page.",
    fields: [
      { name: "value", label: "Value", type: "TEXT", required: true, isTitle: true },
      { name: "label", label: "Label", type: "TEXT", required: true },
      { name: "order", label: "Order", type: "NUMBER" },
    ],
  },
  {
    name: "legal_pages",
    label: "Legal Pages",
    description: "Privacy policy and terms of service.",
    fields: [
      { name: "title", label: "Title", type: "TEXT", required: true, isTitle: true, isSlugSource: true },
      { name: "slug", label: "Slug", type: "TEXT" },
      { name: "content", label: "Content", type: "MARKDOWN", required: true },
    ],
  },
];

const PROJECTS = [
  {
    title: "FinTech Trading Platform",
    slug: "fintech-platform",
    client: "Capital Markets Inc.",
    category: "Financial Services",
    description:
      "A comprehensive trading platform with real-time market data, portfolio management, and advanced analytics dashboard.",
    technologies: ["React", "Node.js", "PostgreSQL", "WebSocket"],
    image: "/images/projects/fintech.jpg",
    featured: true,
    order: 1,
  },
  {
    title: "Healthcare Management System",
    slug: "healthcare-app",
    client: "MedCare Solutions",
    category: "Healthcare",
    description:
      "HIPAA-compliant patient management system with telemedicine capabilities and EHR integration.",
    technologies: ["Next.js", "Python", "AWS", "FHIR"],
    image: "/images/projects/healthcare.jpg",
    featured: true,
    order: 2,
  },
  {
    title: "E-commerce Marketplace",
    slug: "ecommerce-platform",
    client: "RetailHub",
    category: "E-commerce",
    description:
      "Multi-vendor marketplace handling millions of transactions with AI-powered recommendations.",
    technologies: ["React", "GraphQL", "Elasticsearch", "Stripe"],
    image: "/images/projects/ecommerce.jpg",
    featured: true,
    order: 3,
  },
  {
    title: "Smart Logistics Platform",
    slug: "logistics-system",
    client: "FastFreight Co.",
    category: "Logistics",
    description:
      "End-to-end logistics management with real-time tracking, route optimization, and predictive analytics.",
    technologies: ["Vue.js", "Go", "MongoDB", "Google Maps"],
    image: "/images/projects/logistics.jpg",
    featured: false,
    order: 4,
  },
  {
    title: "Online Learning Platform",
    slug: "education-platform",
    client: "EduTech Academy",
    category: "Education",
    description:
      "Interactive learning platform with live classes, progress tracking, and gamification features.",
    technologies: ["Next.js", "WebRTC", "Redis", "OpenAI"],
    image: "/images/projects/education.jpg",
    featured: false,
    order: 5,
  },
  {
    title: "SaaS Analytics Dashboard",
    slug: "saas-dashboard",
    client: "DataMetrics Pro",
    category: "SaaS",
    description:
      "Real-time analytics dashboard with customizable widgets, automated reporting, and data visualization.",
    technologies: ["React", "D3.js", "Python", "ClickHouse"],
    image: "/images/projects/saas.jpg",
    featured: true,
    order: 6,
  },
];

const STATS = [
  { value: "150+", label: "Projects Delivered", order: 1 },
  { value: "50+", label: "Happy Clients", order: 2 },
  { value: "10+", label: "Years Experience", order: 3 },
  { value: "98%", label: "Client Satisfaction", order: 4 },
];

const TESTIMONIALS = [
  {
    quote:
      "Estratico transformed our digital presence completely. Their team delivered beyond our expectations.",
    author: "Sarah Chen",
    role: "CTO, TechVentures",
    avatar: "/images/testimonials/sarah.jpg",
    order: 1,
  },
  {
    quote: "Professional, innovative, and reliable. They understood our vision and brought it to life perfectly.",
    author: "Michael Torres",
    role: "Founder, StartupHub",
    avatar: "/images/testimonials/michael.jpg",
    order: 2,
  },
  {
    quote: "The best technology partner we've worked with. Their expertise in AI integration was exceptional.",
    author: "Emma Williams",
    role: "CEO, DataFlow Inc.",
    avatar: "/images/testimonials/emma.jpg",
    order: 3,
  },
];

const FAQS = [
  {
    question: "What is your typical project timeline?",
    answer:
      "Project timelines vary based on scope and complexity. A typical web application takes 8-12 weeks, while larger enterprise solutions may take 4-6 months. We provide detailed timelines during our discovery phase.",
  },
  {
    question: "Do you offer ongoing maintenance and support?",
    answer:
      "Yes, we offer comprehensive maintenance and support packages. This includes regular updates, security patches, performance monitoring, and technical support to ensure your solution runs smoothly.",
  },
  {
    question: "What technologies do you specialize in?",
    answer:
      "We specialize in modern web technologies including React, Next.js, Node.js, Python, and cloud platforms like AWS and Google Cloud. We choose the best technology stack based on your specific project requirements.",
  },
  {
    question: "How do you handle project communication?",
    answer:
      "We believe in transparent communication. You'll have a dedicated project manager, regular status updates, and access to our project management tools. We schedule weekly calls and provide 24/7 support for critical issues.",
  },
  {
    question: "What is your pricing model?",
    answer:
      "We offer flexible pricing models including fixed-price projects, time and materials, and dedicated team arrangements. We provide detailed proposals after understanding your requirements during our discovery call.",
  },
];

function readLegalMarkdown(fileName: string): string | null {
  const path = resolve(PROFILE_REPO, "public/content", fileName);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

async function ensureField(contentTypeId: string, field: FieldDef, order: number) {
  const existing = await prisma.contentTypeField.findUnique({
    where: { contentTypeId_name: { contentTypeId, name: field.name } },
  });
  if (existing) return;

  await prisma.contentTypeField.create({
    data: {
      contentTypeId,
      name: field.name,
      label: field.label,
      type: field.type as any,
      required: field.required ?? false,
      isTitle: field.isTitle ?? false,
      isSlugSource: field.isSlugSource ?? false,
      options: field.options as any,
      order,
    },
  });
  console.log(`  field: ${field.name} (${field.type})`);
}

async function ensureContentType(siteId: string, def: (typeof CONTENT_TYPES)[number]) {
  const existing = await prisma.contentType.findUnique({
    where: { siteId_name: { siteId, name: def.name } },
    include: { fields: true },
  });
  if (existing) {
    console.log(`type exists: ${def.name} (${existing.fields.length} fields)`);
    return existing;
  }

  const contentType = await prisma.contentType.create({
    data: { siteId, name: def.name, label: def.label, description: def.description },
  });
  console.log(`type created: ${def.name}`);
  for (const [index, field] of def.fields.entries()) {
    await ensureField(contentType.id, field, index);
  }
  return contentType;
}

async function upsertEntry(
  contentType: { id: string; siteId: string },
  slug: string,
  payload: Prisma.InputJsonValue,
  status: "DRAFT" | "PUBLISHED" = "PUBLISHED",
) {
  const existing = await prisma.contentEntry.findUnique({
    where: { contentTypeId_slug: { contentTypeId: contentType.id, slug } },
  });
  if (existing) return false;

  const payloadRecord = payload as Record<string, unknown>;
  const title = String(
    payloadRecord.title ?? payloadRecord.author ?? payloadRecord.question ?? slug,
  );
  await prisma.contentEntry.create({
    data: {
      siteId: contentType.siteId,
      contentTypeId: contentType.id,
      slug,
      title,
      payload,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  console.log(`  entry: ${slug}`);
  return true;
}

async function main() {
  let site = await prisma.site.findUnique({ where: { slug: SITE_SLUG } });
  if (!site) {
    site = await prisma.site.create({
      data: { name: SITE_NAME, slug: SITE_SLUG, description: "The public Estratico website." },
    });
    console.log(`site created: ${SITE_NAME} (${site.id})`);
  } else {
    console.log(`site exists: ${SITE_NAME}`);
  }

  if (!site.apiKeyHash) {
    const apiKey = generateApiKey();
    await prisma.site.update({
      where: { id: site.id },
      data: { apiKeyHash: hashApiKey(apiKey) },
    });
    console.log(`\n==============================================`);
    console.log(`API KEY for "${SITE_NAME}":`);
    console.log(apiKey);
    console.log(`Store it in the website's CMS_API_KEY env var.`);
    console.log(`==============================================\n`);
  }

  const types = new Map<string, { id: string; siteId: string }>();
  for (const def of CONTENT_TYPES) {
    const contentType = await ensureContentType(site.id, def);
    types.set(def.name, contentType);
  }

  const projectsType = types.get("projects")!;
  for (const project of PROJECTS) {
    await upsertEntry(projectsType, project.slug, {
      title: project.title,
      slug: project.slug,
      client: project.client,
      category: project.category,
      description: project.description,
      technologies: project.technologies.map((technology) => ({ technology })),
      image: project.image,
      featured: project.featured,
      order: project.order,
    });
  }

  const statsType = types.get("stats")!;
  for (const stat of STATS) {
    await upsertEntry(statsType, slugify(stat.label), {
      value: stat.value,
      label: stat.label,
      order: stat.order,
    });
  }

  const testimonialsType = types.get("testimonials")!;
  for (const t of TESTIMONIALS) {
    await upsertEntry(testimonialsType, slugify(t.author), {
      quote: t.quote,
      author: t.author,
      role: t.role,
      avatar: t.avatar,
      order: t.order,
    });
  }

  const faqsType = types.get("faqs")!;
  for (const faq of FAQS) {
    await upsertEntry(faqsType, slugify(faq.question), {
      question: faq.question,
      answer: faq.answer,
    });
  }

  const legalType = types.get("legal_pages")!;
  const legalFiles: { slug: string; title: string; fileName: string }[] = [
    { slug: "privacy", title: "Estratico Privacy Policy (2026)", fileName: "estratico_privacy_policy.md" },
    { slug: "terms", title: "Estratico Terms & Conditions", fileName: "estratico_terms.md" },
  ];
  for (const legal of legalFiles) {
    const content = readLegalMarkdown(legal.fileName);
    if (!content) {
      console.log(`  WARN: ${legal.fileName} not found at ${PROFILE_REPO}/public/content`);
      continue;
    }
    await upsertEntry(legalType, legal.slug, {
      title: legal.title,
      slug: legal.slug,
      content,
    });
  }

  const counts = await Promise.all(
    CONTENT_TYPES.map(async (def) => {
      const type = types.get(def.name)!;
      const count = await prisma.contentEntry.count({ where: { contentTypeId: type.id } });
      return `${def.name}:${count}`;
    }),
  );
  console.log(`\nentries seeded: ${counts.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed-estratico-content FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
