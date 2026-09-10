import type { PageModule } from 'ryvax';

export const getStaticPaths = async () => [
  { id: 'atlas-mobile' },
  { id: 'nova-central-de-ajuda' },
  { id: 'checkout-v3' }
];

export const getStaticProps = async (context: Parameters<NonNullable<PageModule['getStaticProps']>>[0]) => {
  const id = String(context.params.id ?? 'project');
  const title = id === 'atlas-mobile' ? 'Atlas mobile' : id.replaceAll('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  return { title, id, progress: title === 'Atlas mobile' ? 78 : 42 };
};

const page: PageModule = {
  default(props) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${props.title} · Pulseboard</title><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"></head><body><div class="detail-page"><a href="/" class="back-link">← Back to overview</a><p class="eyebrow coral-text">PROJECT · ${props.id}</p><h1>${props.title}</h1><p class="detail-copy">A focused view to keep context, pace, and next steps in one place.</p><div class="detail-card"><div><span class="eyebrow">Overall progress</span><strong>${props.progress}%</strong></div><div class="bar large"><i class="coral" style="width:${props.progress}%"></i></div><div class="detail-grid"><div><small>Next delivery</small><b>12 set 2026</b></div><div><small>Owner</small><b>Marina Costa</b></div><div><small>Pace</small><b class="teal-text">On track</b></div></div></div><a href="/api/projects" class="secondary-button">View data through API →</a></div></body></html>`;
  }
};
export default page.default;
