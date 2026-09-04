import type { PageModule } from 'jeston';

export const revalidate = 30;

export const getStaticProps = async () => ({
  user: { name: 'Marina Costa', initials: 'MC' },
  metrics: [
    { label: 'Entregas no prazo', value: '92%', delta: '+8,4%', tone: 'teal' },
    { label: 'Ciclo médio', value: '4,2d', delta: '-1,1d', tone: 'violet' },
    { label: 'Bloqueios ativos', value: '07', delta: '-3 hoje', tone: 'amber' }
  ],
  projects: [
    { name: 'Atlas mobile', team: 'Produto · 8 pessoas', progress: 78, status: 'No ritmo', color: 'coral', eta: '12 set' },
    { name: 'Nova central de ajuda', team: 'Conteúdo · 4 pessoas', progress: 54, status: 'Atenção', color: 'violet', eta: '18 set' },
    { name: 'Checkout v3', team: 'Growth · 6 pessoas', progress: 31, status: 'No ritmo', color: 'teal', eta: '02 out' }
  ],
  activity: [
    ['MC', 'Marina moveu “Revisar onboarding”', 'há 12 min', 'coral'],
    ['RA', 'Rafael concluiu o experimento de checkout', 'há 43 min', 'violet'],
    ['LS', 'Lívia comentou no projeto Atlas mobile', 'há 1 h', 'teal'],
    ['JP', 'João entrou no workspace', 'há 2 h', 'amber']
  ]
});

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));

const page: PageModule = {
  default(props) {
    const metrics = (props.metrics as Array<{label:string;value:string;delta:string;tone:string}>).map((metric) => `
      <article class="metric-card">
        <div class="metric-top"><span>${esc(metric.label)}</span><span class="metric-dot ${metric.tone}"></span></div>
        <strong>${esc(metric.value)}</strong><small class="delta ${metric.tone}">${esc(metric.delta)}</small>
      </article>`).join('');
    const projects = (props.projects as Array<{name:string;team:string;progress:number;status:string;color:string;eta:string}>).map((project) => `
      <a class="project-row" href="/projects/${encodeURIComponent(project.name.toLowerCase().replaceAll(' ', '-'))}">
        <div class="project-main"><span class="project-icon ${project.color}">${project.name.slice(0, 1)}</span><div><strong>${esc(project.name)}</strong><small>${esc(project.team)}</small></div></div>
        <div class="project-progress"><div class="bar"><i class="${project.color}" style="width:${project.progress}%"></i></div><span>${project.progress}%</span></div>
        <span class="status ${project.color}">${esc(project.status)}</span><time>${esc(project.eta)}</time>
      </a>`).join('');
    const activity = (props.activity as string[][]).map(([initials, text, when, tone]) => `<li><span class="avatar ${tone}">${esc(initials)}</span><div><strong>${esc(text)}</strong><small>${esc(when)}</small></div></li>`).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Pulseboard: clareza operacional para times de produto."><title>Pulseboard · Visão geral</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"></head><body><div class="app-shell"><aside class="sidebar"><a class="brand" href="/"><span class="brand-mark">p</span><span>pulseboard</span></a><p class="eyebrow">Workspace</p><nav><a class="nav-link active" href="/"><span>◒</span>Visão geral</a><a class="nav-link" href="/projects/atlas-mobile"><span>□</span>Projetos <b>3</b></a><a class="nav-link" href="/api/health"><span>⌁</span>API health</a></nav><div class="sidebar-bottom"><div class="workspace-switch"><span class="mini-avatar">MC</span><span><small>Workspace atual</small><strong>Estúdio Aurora</strong></span><span>⌄</span></div><a class="nav-link muted" href="#settings"><span>⚙</span>Configurações</a></div></aside><main class="content"><header class="topbar"><div class="mobile-brand"><span class="brand-mark">p</span> pulseboard</div><div class="breadcrumb">Estúdio Aurora <span>/</span> Visão geral</div><div class="top-actions"><button class="icon-button" aria-label="Buscar">⌕</button><button class="icon-button" aria-label="Notificações">♧<i></i></button><span class="avatar coral">MC</span></div></header><section class="hero"><div><p class="eyebrow coral-text">QUINTA-FEIRA, 04 DE SETEMBRO</p><h1>Bom dia, ${esc((props.user as {name:string}).name.split(' ')[0])}<span class="wave">✦</span></h1><p class="hero-sub">Aqui está o pulso do seu time. Pequenos avanços, todos os dias.</p></div><button class="primary-button" onclick="window.location.href='/projects/atlas-mobile'">+ Novo projeto</button></section><section class="metrics">${metrics}</section><section class="dashboard-grid"><div class="panel projects-panel"><div class="panel-head"><div><p class="eyebrow">Acompanhe o trabalho</p><h2>Projetos em andamento</h2></div><a href="/projects/atlas-mobile" class="text-link">Ver todos →</a></div><div class="project-table"><div class="table-labels"><span>PROJETO</span><span>PROGRESSO</span><span>STATUS</span><span>ENTREGA</span></div>${projects}</div></div><aside class="panel activity-panel"><div class="panel-head"><div><p class="eyebrow">Agora</p><h2>Atividade recente</h2></div><span class="live-dot">ao vivo</span></div><ul class="activity-list">${activity}</ul><a class="activity-footer" href="#activity">Abrir atividade completa <span>→</span></a></aside></section><section class="insight"><div class="insight-icon">✦</div><div><p class="eyebrow">Leitura do dia</p><h3>Seu time está 18% mais previsível nesta semana.</h3><p>O ciclo caiu e os bloqueios foram resolvidos mais rápido. Mantenha o foco nos projetos com status “Atenção”.</p></div><span class="insight-line"></span></section><footer><span>Pulseboard</span><span>Dados atualizados há poucos segundos · <a href="/api/health">Status do sistema</a></span></footer></main></div><script>document.querySelectorAll('.project-row').forEach((row,i)=>row.style.setProperty('--i',i));</script></body></html>`;
  }
};

export default page.default;
