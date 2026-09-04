import type { PageModule } from 'jeston';

export const getStaticPaths = async () => [
  { id: 'atlas-mobile' },
  { id: 'nova-central-de-ajuda' },
  { id: 'checkout-v3' }
];

export const getStaticProps = async (context: Parameters<NonNullable<PageModule['getStaticProps']>>[0]) => {
  const id = String(context.params.id ?? 'projeto');
  const title = id === 'atlas-mobile' ? 'Atlas mobile' : id.replaceAll('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  return { title, id, progress: title === 'Atlas mobile' ? 78 : 42 };
};

const page: PageModule = {
  default(props) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${props.title} · Pulseboard</title><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"></head><body><div class="detail-page"><a href="/" class="back-link">← Voltar para visão geral</a><p class="eyebrow coral-text">PROJETO · ${props.id}</p><h1>${props.title}</h1><p class="detail-copy">Uma visão focada para manter contexto, ritmo e próximos passos no mesmo lugar.</p><div class="detail-card"><div><span class="eyebrow">Progresso geral</span><strong>${props.progress}%</strong></div><div class="bar large"><i class="coral" style="width:${props.progress}%"></i></div><div class="detail-grid"><div><small>Próxima entrega</small><b>12 set 2026</b></div><div><small>Responsável</small><b>Marina Costa</b></div><div><small>Ritmo</small><b class="teal-text">No ritmo</b></div></div></div><a href="/api/projects" class="secondary-button">Consultar dados via API →</a></div></body></html>`;
  }
};
export default page.default;
