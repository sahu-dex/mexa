#!/usr/bin/env python3
"""Assemble vendor/ from composer.lock using GitHub zipball dists.

For sandboxes where PHP/Composer are unavailable and packagist.org is
unreachable but api.github.com is allowed. Downloads each locked package's
dist zipball, extracts it to vendor/{owner}/{package}, and writes
vendor/composer/installed.json (used by Laravel's package discovery).

Run regen-autoload.py afterwards to generate the autoloader files.

Requires GH_TOKEN in the environment when the 74 API calls would exceed
GitHub's unauthenticated 60 req/hour limit (e.g. `export GH_TOKEN=$(gh auth token)`).
"""
import json
import os
import sys
import time
import zipfile
import urllib.request
import concurrent.futures
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VENDOR = REPO / 'vendor'
ZIPDIR = Path(os.environ.get('ZIP_CACHE', '/tmp/vendor-zips'))
TOKEN = os.environ.get('GH_TOKEN', '')

lock = json.loads((REPO / 'composer.lock').read_text())
packages = lock['packages']


def fetch(url, dest, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                'Authorization': f'Bearer {TOKEN}',
                'User-Agent': 'mexa-preview-vendor-installer',
                'Accept': 'application/vnd.github+json',
            })
            with urllib.request.urlopen(req, timeout=120) as r:
                dest.write_bytes(r.read())
            return True
        except Exception as e:
            print(f'  retry {attempt + 1} {url}: {e}', flush=True)
            time.sleep(3 + attempt * 5)
    return False


def install_pkg(p):
    name = p['name']
    dest = VENDOR / name
    if (dest / 'composer.json').exists():
        return name, 'cached'
    url = p['dist']['url']
    zfile = ZIPDIR / f"{name.replace('/', '__')}.zip"
    if not zfile.exists() or zfile.stat().st_size < 200:
        if not fetch(url, zfile):
            return name, 'DOWNLOAD-FAILED'
    try:
        with zipfile.ZipFile(zfile) as z:
            names = z.namelist()
            top = names[0].split('/')[0]
            dest.mkdir(parents=True, exist_ok=True)
            for n in names:
                if n == top + '/' or n.endswith('/'):
                    continue
                rel = n[len(top) + 1:]
                if not rel:
                    continue
                target = dest / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(n))
        return name, 'ok'
    except zipfile.BadZipFile:
        zfile.unlink(missing_ok=True)
        return name, 'BAD-ZIP'


def main():
    ZIPDIR.mkdir(parents=True, exist_ok=True)
    VENDOR.mkdir(parents=True, exist_ok=True)
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        for name, status in ex.map(install_pkg, packages):
            results[name] = status
            print(f'{status:8} {name}', flush=True)

    failed = [n for n, s in results.items() if s not in ('ok', 'cached')]
    if failed:
        print('FAILED:', failed)
        sys.exit(1)

    installed = [{
        'name': p['name'],
        'version': p['version'],
        'autoload': p.get('autoload', {}),
        'extra': p.get('extra', {}),
        'license': p.get('license', []),
        'description': p.get('description', ''),
    } for p in packages]

    comp = VENDOR / 'composer'
    comp.mkdir(exist_ok=True)
    (comp / 'installed.json').write_text(json.dumps({
        'packages': installed, 'dev': False, 'dev-package-names': []
    }, indent=1))
    print(f"\nInstalled {len(packages)} packages + composer/installed.json")


if __name__ == '__main__':
    main()
