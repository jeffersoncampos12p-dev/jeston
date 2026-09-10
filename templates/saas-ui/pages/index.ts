import type { PageModule } from '@kvantjs/jeston';

export const revalidate = 30;

export const getStaticProps = async () => ({
  user: { name: 'Marina Costa', initials: 'MC' },
  metrics: [
    { label: 'Entregas no prazo', value: '92%', delta: '+8,4%', tone: 'teal' },
    { label: 'Average cycle', value: '4,2d', delta: '-1,1d', tone: 'violet' },
    { label: 'Bloqueios ativos', value: '07', delta: '-3 hoje', tone: 'amber' }
  ],
  projects: [
    { name: 'Atlas mobile', team: 'Produto · 8 pessoas', progress: 78, status: 'On track', color: 'coral', eta: '12 set' },
    { name: 'New help center', team: 'Content · 4 people', progress: 54, status: 'Attention', color: 'violet', eta: '18 set' },
    { name: 'Checkout v3', team: 'Growth · 6 pessoas', progress: 31, status: 'On track', color: 'teal', eta: '02 out' }
  ],
  activity: [
    ['MC', 'Marina moved “Revisar onboarding”', '12 minutes ago', 'coral'],
    ['RA', 'Rafael completed the checkout experiment', '43 minutes ago', 'violet'],
    ['LS', 'Livia commented on the Atlas mobile project', '1 hour ago', 'teal'],
    ['JP', 'Joao joined the workspace', '2 hours ago', 'amber']
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
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Pulseboard: operational clarity for product teams."><title>Pulseboard · Overview</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"></head><body><div class="app-shell"><aside class="sidebar"><a class="brand" href="/"><span class="brand-mark">p</span><span>pulseboard</span></a><p class="eyebrow">Workspace</p><nav><a class="nav-link active" href="/"><span>◒</span>Overview</a><a class="nav-link" href="/projects/atlas-mobile"><span>□</span>Projects <b>3</b></a><a class="nav-link" href="/api/health"><span>⌁</span>API health</a></nav><div class="sidebar-bottom"><div class="workspace-switch"><span class="mini-avatar">MC</span><span><small>Current workspace</small><strong>Aurora Studio</strong></span><span>⌄</span></div><a class="nav-link muted" href="#settings"><span>⚙</span>Settings</a></div></aside><main class="content"><header class="topbar"><div class="mobile-brand"><span class="brand-mark">p</span> pulseboard</div><div class="breadcrumb">Aurora Studio <span>/</span> Overview</div><div class="top-actions"><button class="icon-button" aria-label="Search">⌕</button><button class="icon-button" aria-label="Notifications">♧<i></i></button><span class="avatar coral">MC</span></div></header><section class="hero"><div><p class="eyebrow coral-text">THURSDAY, SEPTEMBER 04</p><h1>Good morning, ${esc((props.user as {name:string}).name.split(' ')[0])}<span class="wave">✦</span></h1><p class="hero-sub">Here is your team pulse. Small advances, every day.</p></div><button class="primary-button" onclick="window.location.href='/projects/atlas-mobile'">+ New project</button></section><section class="metrics">${metrics}</section><section class="dashboard-grid"><div class="panel projects-panel"><div class="panel-head"><div><p class="eyebrow">Track the work</p><h2>Projects in progress</h2></div><a href="/projects/atlas-mobile" class="text-link">View all →</a></div><div class="project-table"><div class="table-labels"><span>PROJECT</span><span>PROGRESS</span><span>STATUS</span><span>DELIVERY</span></div>${projects}</div></div><aside class="panel activity-panel"><div class="panel-head"><div><p class="eyebrow">Now</p><h2>Recent activity</h2></div><span class="live-dot">live</span></div><ul class="activity-list">${activity}</ul><a class="activity-footer" href="#activity">Open full activity <span>→</span></a></aside></section><section class="insight"><div class="insight-icon">✦</div><div><p class="eyebrow">Today's insight</p><h3>Your team is 18% more predictable this week.</h3><p>Cycle time decreased and blockers were resolved faster. Keep focus on projects with an “Attention” status.</p></div><span class="insight-line"></span></section><footer><span>Pulseboard</span><span>Data updated a few seconds ago · <a href="/api/health">System status</a></span></footer></main></div><script>document.querySelectorAll('.project-row').forEach((row,i)=>row.style.setProperty('--i',i));</script></body></html>`;
  }
};

export default page.default;
