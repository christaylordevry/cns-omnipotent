#!/usr/bin/env python3
"""
vault-lint bulk scan — filesystem-based frontmatter + wikilink engine.
Run from execute_code or directly. Set VAULT and TODAY_STR before use.

Usage (execute_code):
    exec(open('/home/christ/.hermes/skills/cns/vault-lint/scripts/bulk_scan.py').read())
    # then access: governed_md, frontmatters, orphans, stale, errors_r4, dup_groups
    # IMPORTANT: continue in the SAME execute_code block to build and write the report.
    # Do NOT split into a second execute_code call — locals are not shared across calls.
    # The scan engine exposes: scanned, clean, total_errors, total_warnings, error_paths,
    # warn_paths in addition to the named rule sets above.

Session notes:
    2026-05-18: 114 governed notes → R1=0, R2=40, R3=29, R4=0. Runtime ~3s.
    2026-05-17: prior session had R1=0 after remediation.
"""

import os, re
from datetime import date

# ── CONFIG ────────────────────────────────────────────────────────────────────
VAULT = "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
TODAY_STR = date.today().isoformat()
TODAY = date.today()
GOVERNED_DIRS = ["01-Projects", "02-Areas", "03-Resources"]
EDGE_EXCLUDE = {"00-Inbox", "_meta"}

# ── HELPERS ───────────────────────────────────────────────────────────────────
DATE_PAT = re.compile(r'^\d{4}-\d{2}-\d{2}$')
WIKILINK_PAT = re.compile(r'!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]')
UUID_V4 = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE)

REQUIRED_FIELDS = ['pake_id','pake_type','title','created','modified','status',
                   'confidence_score','verification_status','creation_method','tags']
PAKE_TYPES = ['SourceNote','InsightNote','HookSetNote','WeaponsCheckNote',
              'SynthesisNote','WorkflowNote','ValidationNote']
STATUSES = ['draft','in-progress','reviewed','stable','archived']
VERIF_STATUSES = ['pending','verified','disputed']


def extract_frontmatter_and_body(path_str):
    try:
        with open(path_str, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        return {}, "", str(e)
    if not content.startswith('---'):
        return {}, content, None
    rest = content[3:]
    end = rest.find('\n---')
    if end == -1:
        return {}, content, None
    body = rest[end+4:]
    yaml_text = rest[:end]
    fm = {}
    lines = yaml_text.split('\n')
    current_key = None
    current_list = None
    for line in lines:
        if not line.strip():
            continue
        if line.startswith('  - ') or line.startswith('- '):
            val = line.strip().lstrip('- ').strip().strip('"\'')
            if current_key and current_list is not None:
                current_list.append(val)
            continue
        m = re.match(r'^(\w[\w_-]*):\s*(.*)', line)
        if m:
            if current_key and current_list is not None:
                fm[current_key] = current_list
            current_key = m.group(1)
            val = m.group(2).strip().strip('"\'')
            if val == '':
                current_list = []
            else:
                current_list = None
                fm[current_key] = val
    if current_key and current_list is not None:
        fm[current_key] = current_list
    return fm, body, None


# ── INVENTORY ─────────────────────────────────────────────────────────────────
governed_md = []
for gdir in GOVERNED_DIRS:
    for root, dirs, files in os.walk(os.path.join(VAULT, gdir)):
        dirs.sort()  # deterministic traversal order
        for fn in sorted(files):
            if fn.endswith('.md') and fn != '_README.md':
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, VAULT).replace('\\', '/')
                governed_md.append(rel)
governed_set = set(governed_md)

frontmatters = {}
bodies = {}
title_map = {}
for rel in governed_md:
    fm, body, err = extract_frontmatter_and_body(os.path.join(VAULT, rel))
    frontmatters[rel] = fm
    bodies[rel] = body
    t = fm.get('title', '').strip()
    if t:
        if t not in title_map:
            title_map[t] = rel
        else:
            title_map[t] = None  # ambiguous

# ── EDGE FILES (for Rule 2) ────────────────────────────────────────────────────
edge_md = []
for root, dirs, files in os.walk(VAULT):
    rel_root = os.path.relpath(root, VAULT).replace('\\', '/')
    top_dir = rel_root.split('/')[0]
    if top_dir in EDGE_EXCLUDE:
        dirs.clear()
        continue
    for fn in files:
        if fn.endswith('.md'):
            rel = os.path.relpath(os.path.join(root, fn), VAULT).replace('\\', '/')
            edge_md.append(rel)

incoming = {p: 0 for p in governed_md}
for edge_rel in edge_md:
    _, body, _ = extract_frontmatter_and_body(os.path.join(VAULT, edge_rel))
    for target in WIKILINK_PAT.findall(body):
        target = target.strip()
        if not target:
            continue
        resolved = None
        if target.startswith('/'):
            c = target.lstrip('/')
            resolved = c if c in governed_set else (c + '.md' if c + '.md' in governed_set else None)
        elif '/' in target:
            resolved = target if target in governed_set else (target + '.md' if target + '.md' in governed_set else None)
        elif target.endswith('.md'):
            sd = os.path.dirname(edge_rel)
            same = os.path.join(sd, target).replace('\\', '/')
            resolved = same if same in governed_set else (target if target in governed_set else None)
        else:
            t = title_map.get(target)
            resolved = t if t is not None else next((p for p in governed_set if os.path.basename(p) == target + '.md'), None)
        if resolved and resolved in incoming:
            incoming[resolved] += 1

# ── RULE 1: duplicate source_uri ──────────────────────────────────────────────
source_notes_map = {r: f for r, f in frontmatters.items() if f.get('pake_type') == 'SourceNote'}
uri_map = {}
for rel, fm in source_notes_map.items():
    uri = fm.get('source_uri', '').strip()
    if uri:
        uri_map.setdefault(uri, []).append(rel)
dup_groups = {uri: sorted(paths) for uri, paths in uri_map.items() if len(paths) >= 2}

# ── RULE 2: orphans ───────────────────────────────────────────────────────────
orphans = sorted([(rel, frontmatters[rel].get('pake_type', 'unknown'),
                   frontmatters[rel].get('title', os.path.basename(rel)))
                  for rel, cnt in incoming.items() if cnt == 0])

# ── RULE 3: stale pending ─────────────────────────────────────────────────────
stale = []
for rel, fm in frontmatters.items():
    vs = fm.get('verification_status', '').strip()
    created = fm.get('created', '').strip()
    if vs == 'pending' and DATE_PAT.match(created):
        days = (TODAY - date.fromisoformat(created)).days
        if days > 14:
            stale.append((rel, fm.get('pake_type', 'unknown'), days, created))
stale.sort()

# ── RULE 4: missing/invalid frontmatter ───────────────────────────────────────
errors_r4 = []
warnings_r4_uuid = []
for rel, fm in frontmatters.items():
    note_errors = []
    note_warnings = []
    for field in REQUIRED_FIELDS:
        val = fm.get(field)
        if val is None or (isinstance(val, str) and not val.strip()) or (isinstance(val, list) and not val):
            note_errors.append(f"missing_{field}")
            continue
        if field == 'pake_type' and val not in PAKE_TYPES:
            note_errors.append(f"invalid_pake_type: {val}")
        elif field == 'status' and val not in STATUSES:
            note_errors.append(f"invalid_status: {val}")
        elif field == 'verification_status' and val.strip() not in VERIF_STATUSES:
            note_errors.append(f"invalid_verification_status: {val}")
        elif field in ('created', 'modified') and not DATE_PAT.match(val.strip()):
            note_errors.append(f"invalid_date_{field}: {val}")
        elif field == 'confidence_score':
            try:
                s = float(val)
                if not 0.0 <= s <= 1.0:
                    note_errors.append(f"out_of_range_confidence_score: {val}")
            except Exception:
                note_errors.append(f"invalid_confidence_score: {val}")
        elif field == 'tags' and not isinstance(val, list):
            note_errors.append("tags_not_list")
        elif field == 'pake_id' and isinstance(val, str) and val.strip():
            if not UUID_V4.match(val.strip()):
                note_warnings.append(f"pake_id_not_uuid_v4: {val}")
    if note_errors:
        errors_r4.append((rel, note_errors, fm.get('created', 'unknown'), fm.get('modified', 'unknown')))
    if note_warnings:
        warnings_r4_uuid.append((rel, note_warnings))
errors_r4.sort()

# ── SUMMARY ───────────────────────────────────────────────────────────────────
error_paths = set(r for r, _, _, _ in errors_r4) | set(p for paths in dup_groups.values() for p in paths)
warn_paths = set(r for r, _, _, _ in stale) | set(r for r, _ in warnings_r4_uuid) | set(r for r, _, _ in orphans)
clean = len(governed_md) - len(error_paths | warn_paths)
scanned = len(governed_md)
total_errors = len(dup_groups) + len(errors_r4)
total_warnings = len(orphans) + len(stale) + len(warnings_r4_uuid)

print(f"Scanned={scanned} Clean={clean} Errors={total_errors} Warnings={total_warnings}")
print(f"  R1(dup)={len(dup_groups)} R2(orphan)={len(orphans)} R3(stale)={len(stale)} R4(missing)={len(errors_r4)} R4(uuid)={len(warnings_r4_uuid)}")
