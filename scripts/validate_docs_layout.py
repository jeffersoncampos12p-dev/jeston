from pathlib import Path
import json
import re

root = Path('/home/ubuntu/ryvax-repo/path/to/docs')
data = json.loads((root / 'docs.json').read_text())
nav = [page for group in data['navigation']['groups'] for page in group['pages']]
missing = [page for page in nav if not (root / (page + '.mdx')).exists()]
assert not missing, missing

for page in root.rglob('*.mdx'):
    if page.name == 'untitled-page.mdx':
        continue
    source = page.read_text()
    for tag in ['Info', 'Warning', 'Tip', 'Note', 'Check', 'Card', 'Columns', 'Steps', 'Step', 'Tabs', 'Tab', 'AccordionGroup', 'Accordion']:
        opening = len(re.findall(r'<'+tag+r'\b', source))
        closing = source.count('</'+tag+'>')
        assert opening == closing, (page, tag, opening, closing)
    assert source.startswith('---')
    assert 'subtitle:' in source.split('---', 2)[1]
    assert 'icon:' in source.split('---', 2)[1]
    assert '<Accordion title="Background and detailed explanation"' in source

print(f'pages={len(nav)} total_lines={sum(len(p.read_text().splitlines()) for p in root.rglob("*.mdx"))}')
